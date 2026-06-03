import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderViewerDocument } from "./document.js";
import { createViewerNonce, buildViewerCsp, timingSafeCompare } from "../auth.js";

// Self-host the viewer favicon at /favicon.svg instead of an inline
// data: URI so the viewer CSP can stay tight at `img-src 'self'`.
// Mirrors loadViewerTemplate() in document.ts — same candidate paths so
// it resolves both from source (vitest) and from dist/ (npm run start).
function loadViewerFavicon(): Buffer | null {
  const base = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(base, "..", "src", "viewer", "favicon.svg"),
    join(base, "..", "viewer", "favicon.svg"),
    join(base, "viewer", "favicon.svg"),
  ];
  for (const path of candidates) {
    try {
      return readFileSync(path);
    } catch {}
  }
  return null;
}

// Favicon is static — load once at module init instead of one synchronous
// disk read per /favicon.svg request.
const VIEWER_FAVICON: Buffer | null = loadViewerFavicon();

const ALLOWED_ORIGINS = (
  process.env.VIEWER_ALLOWED_ORIGINS ||
  "http://localhost:3111,http://localhost:3113,http://127.0.0.1:3111,http://127.0.0.1:3113"
)
  .split(",")
  .map((o) => o.trim());

// Hosts the viewer will accept in the Host header. Restricting this is the
// defence against DNS rebinding: a browser visiting `attacker.com` whose
// authoritative DNS rebinds to 127.0.0.1 hits the viewer's listening socket
// directly, the Origin header reads `http://attacker.com` (same-origin from
// the browser's perspective on a same-port attacker page, so no preflight
// fires), and the request body is whatever the page wants. The viewer
// proxies it to the local REST API with the AGENTMEMORY_SECRET bearer
// attached, so the response stream is fully privileged. Rejecting any Host
// not in this allowlist closes that path before the proxy runs.
//
// Explicit override via VIEWER_ALLOWED_HOSTS for the rare case of a
// reverse-proxy in front of the viewer; defaults are computed from the
// listen port at server-create time. Read on each call (no module-level
// caching) so tests can rotate the env var between startViewerServer()
// and the first request. Note: `buildAllowedHosts` only re-runs on a
// cache miss for the in-process `allowedHosts` set, so production env
// changes after the first request require a restart.
function readAllowedHostsOverride(): string[] {
  return (process.env.VIEWER_ALLOWED_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function resolveViewerHost(): string {
  return process.env.AGENTMEMORY_VIEWER_HOST?.trim() || "127.0.0.1";
}

export function isLoopbackHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return h === "127.0.0.1" || h === "::1" || h === "localhost";
}

export function buildAllowedHosts(
  origins: string[],
  listenPort: number,
  bindHost: string = "127.0.0.1",
): Set<string> {
  const hosts = new Set<string>();
  // When bind is loopback the listening socket is unreachable from the
  // network, so it's safe to seed the allowlist from the CORS origins
  // (which by default are localhost-based) plus the standard loopback
  // hostnames on the actual listen port. When bind is non-loopback the
  // listening socket is reachable from anywhere TCP can reach the
  // process, and any of those loopback names becomes a spoofable Host
  // header — so only explicit VIEWER_ALLOWED_HOSTS entries are trusted.
  if (isLoopbackHost(bindHost)) {
    for (const o of origins) {
      try {
        const parsed = new URL(o);
        if (parsed.host) hosts.add(parsed.host.toLowerCase());
      } catch {
        // Skip invalid origin entries — the existing CORS path already
        // tolerates them by simply not matching; mirror that here.
      }
    }
    hosts.add(`localhost:${listenPort}`);
    hosts.add(`127.0.0.1:${listenPort}`);
    hosts.add(`[::1]:${listenPort}`);
  }
  for (const h of readAllowedHostsOverride()) hosts.add(h);
  return hosts;
}

export function isHostAllowed(
  headerHost: string | string[] | undefined,
  allowed: Set<string>,
): boolean {
  if (typeof headerHost !== "string") return false;
  const lower = headerHost.toLowerCase().trim();
  if (!lower) return false;
  return allowed.has(lower);
}

// When bind is non-loopback the viewer is a bearer-authorized proxy
// reachable from the network, so every request that would forward
// upstream must also present the same bearer. Static routes (HTML,
// favicon) stay open so a browser can fetch the shell — the JS inside
// then has to provide a bearer for the API calls.
export function requireInboundBearer(
  authHeader: string | string[] | undefined,
  secret: string,
): boolean {
  if (typeof authHeader !== "string") return false;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authHeader);
  if (!match) return false;
  return timingSafeCompare(match[1], secret);
}

function corsHeaders(req: IncomingMessage): Record<string, string> {
  const origin = req.headers.origin || "";
  const allowed = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

function json(
  res: ServerResponse,
  status: number,
  data: unknown,
  req?: IncomingMessage,
): void {
  const body = JSON.stringify(data);
  const cors = req
    ? corsHeaders(req)
    : { "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0], Vary: "Origin" };
  res.writeHead(status, { ...cors, "Content-Type": "application/json" });
  res.end(body);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) {
        req.destroy();
        reject(new Error("too large"));
        return;
      }
      data += chunk.toString();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const MAX_VIEWER_PORT_RETRIES = 10;
const VIEWER_SESSION_COOKIE = "agentmemory_viewer_session";
const VIEWER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

function getViewerPassword(): string {
  return process.env["AGENTMEMORY_VIEWER_PASSWORD"] || "";
}

function parseCookies(header: string | string[] | undefined): Record<string, string> {
  const raw = Array.isArray(header) ? header.join(";") : header || "";
  const cookies: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

function isViewerAuthenticated(req: IncomingMessage, sessionToken: string): boolean {
  const token = parseCookies(req.headers.cookie)[VIEWER_SESSION_COOKIE];
  return typeof token === "string" && timingSafeCompare(token, sessionToken);
}

function secureCookieFlag(req: IncomingMessage): string {
  return req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
}

function renderViewerLoginPage(message = ""): { html: string; csp: string } {
  const nonce = createViewerNonce();
  const escapedMessage = message.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[ch] || ch;
  });
  return {
    csp: buildViewerCsp(nonce),
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>agentmemory viewer login</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f7f9; color: #111; }
    main { width: min(360px, calc(100vw - 32px)); }
    h1 { margin: 0 0 8px; font-size: 24px; font-weight: 650; letter-spacing: 0; }
    p { margin: 0 0 20px; color: #5b616e; line-height: 1.5; }
    label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600; color: #303540; }
    input { box-sizing: border-box; width: 100%; height: 42px; border: 1px solid #c7ccd4; border-radius: 6px; padding: 0 12px; font: inherit; background: #fff; color: #111; }
    button { width: 100%; height: 42px; margin-top: 12px; border: 0; border-radius: 6px; background: #111; color: #fff; font: inherit; font-weight: 650; cursor: pointer; }
    .error { min-height: 20px; margin-top: 12px; color: #b42318; font-size: 13px; }
    @media (prefers-color-scheme: dark) {
      body { background: #101214; color: #f4f6f8; }
      p { color: #aab2bd; }
      label { color: #d7dde5; }
      input { background: #171a1f; color: #f4f6f8; border-color: #3a414b; }
      button { background: #f4f6f8; color: #111; }
    }
  </style>
</head>
<body>
  <main>
    <h1>agentmemory viewer</h1>
    <p>Enter the viewer password to continue.</p>
    <form id="login-form">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
      <button type="submit">Sign in</button>
      <div id="error" class="error">${escapedMessage}</div>
    </form>
  </main>
  <script nonce="${nonce}">
    var form = document.getElementById('login-form');
    var password = document.getElementById('password');
    var error = document.getElementById('error');
    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      error.textContent = '';
      var res = await fetch('/viewer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.value })
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      error.textContent = 'Invalid password';
      password.select();
    });
  </script>
</body>
</html>`,
  };
}

async function readViewerPassword(req: IncomingMessage): Promise<string> {
  const body = await readBody(req);
  const contentType = req.headers["content-type"] || "";
  if (typeof contentType === "string" && contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(body) as { password?: unknown };
      return typeof parsed.password === "string" ? parsed.password : "";
    } catch {
      return "";
    }
  }
  const params = new URLSearchParams(body);
  return params.get("password") || "";
}

let boundViewerPort: number | null = null;
let viewerSkipped = false;

export function getBoundViewerPort(): number | null {
  return boundViewerPort;
}
export function getViewerSkipped(): boolean {
  return viewerSkipped;
}

export class ViewerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewerConfigError";
  }
}

export function startViewerServer(
  port: number,
  _kv: unknown,
  _sdk: unknown,
  secret?: string,
  restPort?: number,
): Server {
  // Reset exported runtime state for each start attempt.
  boundViewerPort = null;
  viewerSkipped = false;

  const resolvedRestPort = restPort ?? port - 2;
  const requestedPort = port;
  const viewerPassword = getViewerPassword();
  const viewerSessionToken = createViewerNonce();
  const host = resolveViewerHost();
  let inboundSecret: string | null = null;

  // Non-loopback bind turns the viewer into a network-reachable
  // bearer-authorized proxy. Refuse to start unless the operator has
  // both an inbound secret to authenticate callers against and an
  // explicit Host header allowlist; otherwise the listening socket
  // becomes an open relay to the local REST API.
  if (!isLoopbackHost(host)) {
    if (!secret) {
      throw new ViewerConfigError(
        `AGENTMEMORY_VIEWER_HOST=${host} requires AGENTMEMORY_SECRET to be set so the viewer can validate inbound bearer tokens. To fix: unset AGENTMEMORY_VIEWER_HOST to keep the safe loopback bind, or set AGENTMEMORY_SECRET. For Fly images, it is printed on first boot; see deploy/fly/README.md.`,
      );
    }
    if (readAllowedHostsOverride().length === 0) {
      throw new ViewerConfigError(
        `AGENTMEMORY_VIEWER_HOST=${host} requires VIEWER_ALLOWED_HOSTS because non-loopback viewer binds only trust explicit Host headers. To fix: set VIEWER_ALLOWED_HOSTS to a comma-separated list of trusted Host header values (e.g. "localhost:3113" for fly proxy), or unset AGENTMEMORY_VIEWER_HOST to keep the safe loopback bind.`,
      );
    }
    inboundSecret = secret;
  }

  // Computed lazily on first request — `port` may be 0 here (OS-assigned)
  // or the EADDRINUSE retry loop below may bump us to a different port,
  // so we read the actual bound port from server.address() on first hit.
  let allowedHosts: Set<string> | null = null;

  const server = createServer(async (req, res) => {
    if (!allowedHosts) {
      const addr = server.address();
      const actualPort =
        addr && typeof addr === "object" && "port" in addr
          ? (addr.port as number)
          : port;
      allowedHosts = buildAllowedHosts(ALLOWED_ORIGINS, actualPort, host);
    }
    if (!isHostAllowed(req.headers.host, allowedHosts)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("forbidden host");
      return;
    }

    const raw = req.url || "/";
    const qIdx = raw.indexOf("?");
    const pathname = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
    const qs = qIdx >= 0 ? raw.slice(qIdx + 1) : "";
    const method = req.method || "GET";

    if (method === "OPTIONS") {
      res.writeHead(204, {
        ...corsHeaders(req),
        "Access-Control-Max-Age": "86400",
      });
      res.end();
      return;
    }

    if (viewerPassword) {
      if (method === "POST" && pathname === "/viewer/login") {
        const password = await readViewerPassword(req);
        if (!timingSafeCompare(password, viewerPassword)) {
          json(res, 401, { error: "unauthorized" }, req);
          return;
        }
        res.writeHead(204, {
          ...corsHeaders(req),
          "Set-Cookie": `${VIEWER_SESSION_COOKIE}=${encodeURIComponent(viewerSessionToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${VIEWER_SESSION_MAX_AGE_SECONDS}${secureCookieFlag(req)}`,
        });
        res.end();
        return;
      }
      if (!isViewerAuthenticated(req, viewerSessionToken)) {
        if (
          method === "GET" &&
          (pathname === "/" ||
            pathname === "/viewer" ||
            pathname === "/agentmemory/viewer")
        ) {
          const rendered = renderViewerLoginPage();
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy": rendered.csp,
            "Cache-Control": "no-cache",
          });
          res.end(rendered.html);
          return;
        }
        json(res, 401, { error: "viewer login required" }, req);
        return;
      }
    }

    if (
      method === "GET" &&
      (pathname === "/" ||
        pathname === "/viewer" ||
        pathname === "/agentmemory/viewer")
    ) {
      const rendered = renderViewerDocument();
      if (rendered.found) {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": rendered.csp,
          "Cache-Control": "no-cache",
        });
        res.end(rendered.html);
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("viewer not found");
      return;
    }

    if (method === "GET" && pathname === "/favicon.svg") {
      if (VIEWER_FAVICON) {
        res.writeHead(200, {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=3600",
        });
        res.end(VIEWER_FAVICON);
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("favicon not found");
      return;
    }

    if (
      inboundSecret !== null &&
      !requireInboundBearer(req.headers.authorization, inboundSecret)
    ) {
      res.writeHead(401, {
        "Content-Type": "text/plain",
        "WWW-Authenticate": 'Bearer realm="agentmemory-viewer"',
      });
      res.end("unauthorized");
      return;
    }

    try {
      await proxyToRestApi(resolvedRestPort, pathname, qs, method, req, res, secret);
    } catch (err) {
      console.error(`[viewer] proxy error on ${method} ${pathname}:`, err);
      json(res, 502, { error: "upstream error" }, req);
    }
  });

  let attempt = 0;
  let currentPort = requestedPort;

  const tryListen = (): void => {
    server.listen(currentPort, host);
  };

  server.on("listening", () => {
    const addr = server.address();
    // `currentPort` is the value passed to `listen()` and stays 0 for
    // ephemeral-port callers (tests, port=0). `server.address()` exposes
    // the OS-assigned port — log that so the startup line is accurate.
    const actualPort =
      addr && typeof addr === "object" && "port" in addr
        ? addr.port
        : currentPort;
    boundViewerPort = actualPort;
    viewerSkipped = false;
    if (inboundSecret !== null) {
      const allowedHosts = readAllowedHostsOverride().join(", ");
      console.log(
        `[agentmemory] Viewer: http://localhost:${actualPort} (bound to ${host}; inbound Bearer required; allowed Host headers: ${allowedHosts})`,
      );
      return;
    }
    if (actualPort === requestedPort) {
      console.log(`[agentmemory] Viewer: http://localhost:${actualPort}`);
    } else {
      console.log(
        `[agentmemory] Viewer started on http://localhost:${actualPort} (fallback from ${requestedPort})`,
      );
    }
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (
      err.code === "EADDRINUSE" &&
      inboundSecret === null &&
      attempt < MAX_VIEWER_PORT_RETRIES
    ) {
      attempt++;
      currentPort = requestedPort + attempt;
      setImmediate(tryListen);
      return;
    }
    if (err.code === "EADDRINUSE") {
      boundViewerPort = null;
      viewerSkipped = true;
      if (inboundSecret !== null) {
        console.warn(
          `[agentmemory] Viewer port ${requestedPort} is in use while bound to ${host}; not retrying because non-loopback viewer binds require VIEWER_ALLOWED_HOSTS to match the exact port. Free the port, choose another viewer port, or unset AGENTMEMORY_VIEWER_HOST to keep the safe loopback bind.`,
        );
      } else {
        console.warn(
          `[agentmemory] Viewer ports ${requestedPort}-${requestedPort + MAX_VIEWER_PORT_RETRIES} all in use, skipping viewer.`,
        );
      }
    } else {
      boundViewerPort = null;
      viewerSkipped = true;
      console.error(`[agentmemory] Viewer error:`, err.message);
    }
  });

  tryListen();

  return server;
}

async function proxyToRestApi(
  restPort: number,
  pathname: string,
  qs: string,
  method: string,
  req: IncomingMessage,
  res: ServerResponse,
  secret?: string,
): Promise<void> {
  const upstreamPath = pathname.startsWith("/agentmemory/")
    ? pathname
    : `/agentmemory${pathname.startsWith("/") ? pathname : "/" + pathname}`;

  const upstreamUrl = `http://127.0.0.1:${restPort}${upstreamPath}${qs ? "?" + qs : ""}`;

  const headers: Record<string, string> = {};
  if (secret) {
    headers["Authorization"] = `Bearer ${secret}`;
  }
  const ct = req.headers["content-type"];
  if (ct) {
    headers["Content-Type"] = ct;
  }

  let body: string | undefined;
  if (method === "POST" || method === "PUT" || method === "DELETE" || method === "PATCH") {
    body = await readBody(req);
  }

  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), 10000);
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body: body || undefined,
      signal: controller.signal,
    });
    clearTimeout(fetchTimeout);
  } catch (err) {
    clearTimeout(fetchTimeout);
    if (err instanceof Error && err.name === "AbortError") {
      json(res, 504, { error: "upstream timeout" }, req);
      return;
    }
    throw err;
  }

  const cors = corsHeaders(req);
  const responseBody = await upstream.text();
  const responseHeaders: Record<string, string> = {
    ...cors,
  };
  const upstreamCt = upstream.headers.get("content-type");
  if (upstreamCt) {
    responseHeaders["Content-Type"] = upstreamCt;
  }

  res.writeHead(upstream.status, responseHeaders);
  res.end(responseBody);
}
