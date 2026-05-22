# Fork Release Notes

This fork publishes its npm packages under the `@nightwatcher314` scope.

## Package Naming

npm scoped package names only support one package segment after the scope:

- Supported: `@nightwatcher314/agentmemory`
- Supported: `@nightwatcher314/agentmemory-mcp`
- Not supported as a package name: `@nightwatcher314/agentmemory/mcp`

Use a separate shim package for MCP instead of trying to publish a nested
package path.

## Publishing Workflow

1. Bump every published/runtime version together:
   - `package.json`
   - `packages/mcp/package.json`
   - `packages/mcp/package.json` dependency on `@nightwatcher314/agentmemory`
   - `src/version.ts`
   - plugin manifests under `plugin/.codex-plugin/` and `plugin/.claude-plugin/`
   - Keep the fork suffix in `src/version.ts` so exported data records the
     actual fork package version. Import compatibility should be checked
     against the upstream schema version before the prerelease suffix, for
     example `0.9.18-nightwatcher.0` is compatible with schema `0.9.18`.
2. Build and test before publishing:
   - `npx vitest run test/context-lessons.test.ts test/export-import.test.ts test/consistency.test.ts test/mcp-resources.test.ts test/mcp-prompts.test.ts test/mcp-transport.test.ts test/mcp-standalone-proxy.test.ts test/mcp-standalone.test.ts`
   - `npm run build`
3. Dry-run both packages:
   - `npm publish --dry-run --access public --tag nightwatcher`
   - `cd packages/mcp && npm publish --dry-run --access public --tag nightwatcher --provenance=false`
4. Publish the root package first, then publish the MCP shim:
   - `npm publish --access public --tag nightwatcher`
   - `cd packages/mcp && npm publish --access public --tag nightwatcher --provenance=false`
5. Move dist-tags when this fork version should be the default:
   - `npm dist-tag add @nightwatcher314/agentmemory@<version> latest`
   - `npm dist-tag add @nightwatcher314/agentmemory-mcp@<version> latest`
6. Verify the registry state:
   - `npm view @nightwatcher314/agentmemory dist-tags --json`
   - `npm view @nightwatcher314/agentmemory-mcp dist-tags dependencies --json`

Use a granular npm access token with publish rights and 2FA bypass for local
publishing when the npm account uses passkeys instead of visible OTP codes.
Never commit the token. After publishing, remove it from npm config and revoke
it from npm if it was exposed in chat or logs:

```sh
npm config delete //registry.npmjs.org/:_authToken
```

The MCP shim package has `publishConfig.provenance: true`. Local publishing is
not a supported provenance provider, so publish the shim locally with
`--provenance=false`. A CI release can keep provenance enabled.

## Codex Plugin MCP Launcher

Codex plugin installs read MCP server wiring from `plugin/.mcp.json` via
`plugin/.codex-plugin/plugin.json`.

The default launcher in this fork is intentionally `npx`:

```json
{
  "mcpServers": {
    "agentmemory": {
      "command": "npx",
      "args": ["-y", "@nightwatcher314/agentmemory-mcp"]
    }
  }
}
```

`pnpx` also works locally, but the default was restored to `npx` to match the
upstream plugin shape and common Codex marketplace expectations. If testing is
blocked by optional native dependency install scripts, use a one-off smoke test
with scripts disabled instead of changing the plugin default:

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"resources/list","params":{}}' |
  npm_config_ignore_scripts=true AGENTMEMORY_PROBE_TIMEOUT_MS=50 \
  npx -y @nightwatcher314/agentmemory-mcp
```

## MCP Standard Methods

The HTTP server already exposes resource and prompt endpoints, but MCP clients
talk to the stdio shim. If `resources/list` returns `Unknown method`, the
missing piece is usually `src/mcp/standalone.ts`, not the HTTP server.

The stdio shim should:

- Advertise `resources` and `prompts` in `initialize.capabilities`.
- Handle `resources/list`.
- Handle `resources/templates/list`.
- Handle `resources/read`.
- Handle `prompts/list`.
- Handle `prompts/get`.
- Proxy to the running HTTP server when available.
- Return useful local fallback data when no server is reachable.

Smoke-test the published shim with JSON-RPC, not just with unit tests:

```sh
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"resources/list","params":{}}' |
  AGENTMEMORY_PROBE_TIMEOUT_MS=50 npx -y @nightwatcher314/agentmemory-mcp
```
