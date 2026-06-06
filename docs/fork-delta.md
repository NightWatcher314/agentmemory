# Fork Delta from Upstream

Last reviewed: 2026-06-06

This document records the intentional differences carried by the
`NightWatcher314/agentmemory` fork relative to upstream `rohitg00/agentmemory`.
Use it during upstream merges to decide which fork changes must be preserved,
which conflicts are expected, and which changes can be dropped if upstream
absorbs them.

## Current remote model

- `origin` — `https://github.com/NightWatcher314/agentmemory`, this fork.
- `upstream` — `https://github.com/rohitg00/agentmemory`, source project.
- Upstream sync merges should merge `upstream/main` into local `main`, then push
  to `origin/main`.

## High-level fork features

### 1. Fork package identity and distribution

The fork publishes under the `@nightwatcher314` npm scope and keeps marketplace
links pointed at the fork repository.

Preserve these unless intentionally switching back to upstream packages:

- `package.json`: `@nightwatcher314/agentmemory`
- `packages/mcp/package.json`: `@nightwatcher314/agentmemory-mcp`
- `plugin/.mcp.json`: `npx -y @nightwatcher314/agentmemory-mcp`
- `plugin/.codex-plugin/plugin.json`, `plugin/.claude-plugin/plugin.json`: fork
  version, author, homepage, repository, and skill/tool counts.
- `.codex-plugin/marketplace.json`: `NightWatcher314/agentmemory.git`
- README and integration docs should reference the fork package names.

Related commits:

- `b69efa6` — README/package docs links for fork packages.
- `bb50f47` — restored `npx` as the MCP launcher while keeping fork package
  names.
- `3da618f` — fork release workflow docs.

Common merge conflict pattern: upstream changes `@nightwatcher314/*` back to
`@agentmemory/*` and `NightWatcher314/agentmemory` back to
`rohitg00/agentmemory`. Keep the fork identity in this repository.

### 2. MCP stdio shim resources and prompts

The fork keeps standard MCP resources and prompts implemented in the standalone
stdio shim, not only in the HTTP server. This matters because plugin-installed
MCP clients talk to `src/mcp/standalone.ts`.

Preserve support for:

- `initialize.capabilities.resources`
- `initialize.capabilities.prompts`
- `resources/list`
- `resources/templates/list`
- `resources/read`
- `prompts/list`
- `prompts/get`
- proxying to the running HTTP server when available
- local fallback data when no server is reachable

Related commit:

- `2faee42` — added standard MCP resources/prompts support to the shim.

Common merge conflict pattern: upstream may simplify `src/mcp/standalone.ts` and
remove resource/prompt fallback logic. Re-apply or preserve the local handlers
unless upstream has equivalent stdio MCP support.

### 3. Documentation-first memory skills

The fork carries more Codex/plugin skills than upstream and makes project docs
the source of truth for project-specific knowledge.

Preserve these local skills and refinements:

- `plugin/skills/document-project-memory/SKILL.md`
- `plugin/skills/learn-codebase/SKILL.md`
- refined `remember`, `recall`, `forget`, and `session-history` skills
- plugin manifest description advertising 10 skills when the local set contains
  10 skills.

Related commits:

- `980f75f` — refined documentation-oriented memory skills.
- `f504bd2` — added `learn-codebase` skill.

Common merge conflict pattern: upstream may report fewer skills and delete the
local skill files. Keep local skills unless upstream has adopted equivalent
workflows.

### 4. Local Docker/source-build deployment

The fork removes the upstream Coolify template and keeps a local source-build
Docker path.

Preserve:

- `Dockerfile.local`
- `.dockerignore`
- `docker-compose.yml` local build/bind-port shape
- `deploy/entrypoint.sh` package path adjustments for fork package names
- Docker build behavior that avoids install-time postinstall scripts and keeps
  dependency cache layers efficient.

Related commits:

- `c5ed340` — local Docker compose/entrypoint updates.
- `4c9488a` — local Docker source build.
- `4d275f2` — removed upstream Coolify deployment template.
- `129031f` — fixed Docker entrypoint package path.
- `d084586` — avoided Docker build postinstall scripts.
- `3db4fd0` — optimized Dockerfile dependency cache.

Common merge conflict pattern: upstream may reintroduce `deploy/coolify/*` and
rewrite `docker-compose.yml` around a different iii-engine/Coolify deployment
shape. Keep local deployment files unless explicitly choosing to adopt upstream
Coolify deployment.

### 5. Fork maintenance docs and sync policy

The fork keeps local maintenance docs for release and upstream sync.

Preserve:

- `docs/upstream-sync.md`
- `docs/fork-release-notes.md`
- this file, `docs/fork-delta.md`
- `AGENTS.md` pointers to these docs.

Related commits:

- `6936ae6` — upstream sync workflow docs.
- `b45b7a4` — configuration review requirements during sync.
- `3da618f` — fork release workflow docs.

## Commit ledger

### Active fork feature commits

| Commit | Date | Area | Keep because |
|---|---:|---|---|
| `c5ed340` | 2026-05-17 | Docker | Local compose/entrypoint deployment changes. |
| `4c9488a` | 2026-05-17 | Docker | Adds `Dockerfile.local`, `.dockerignore`, source-build docs. |
| `6936ae6` | 2026-05-17 | Docs | Adds upstream sync workflow. |
| `4d275f2` | 2026-05-17 | Docker | Removes upstream Coolify template in favor of local deployment. |
| `b45b7a4` | 2026-05-17 | Docs | Adds config/security review checklist for upstream sync. |
| `2faee42` | 2026-05-17 | MCP | Adds stdio MCP resources/prompts support and fork package versions. |
| `bb50f47` | 2026-05-17 | MCP/package | Restores `npx` launcher for plugin MCP. |
| `3da618f` | 2026-05-17 | Docs/release | Documents fork npm publishing workflow. |
| `b69efa6` | 2026-05-18 | Package/docs | Points README/package docs at fork packages. |
| `129031f` | 2026-05-18 | Docker | Fixes entrypoint package path for fork package names. |
| `980f75f` | 2026-05-18 | Skills | Refines memory skills around project-doc source of truth. |
| `f504bd2` | 2026-05-19 | Skills | Adds `learn-codebase` skill. |
| `d084586` | 2026-05-19 | Docker | Avoids postinstall scripts during Docker build. |
| `3db4fd0` | 2026-05-19 | Docker | Improves Docker dependency cache. |

### Dropped fork deltas

| Commit | Date | Area | Dropped because |
|---|---:|---|---|
| `be0146e` | 2026-05-18 | Viewer/security | Dropped on 2026-06-06; upstream now provides the non-loopback viewer safety model through `AGENTMEMORY_VIEWER_HOST`, `AGENTMEMORY_SECRET`, and `VIEWER_ALLOWED_HOSTS`, so the fork-only `AGENTMEMORY_VIEWER_PASSWORD` login layer is no longer carried. |

### Merge commits

These are historical upstream-sync markers, not standalone features:

- `b9aee1a` — merge remote-tracking branch `origin/main` during early fork work.
- `fc8d372` — merge upstream v0.9.18 into fork.
- `eea37a4` — merge upstream v0.9.20 into fork.
- `de7603e` — merge upstream v0.9.21 into fork.
- `0b5e807` — merge upstream post-v0.9.21 updates into fork.

## Upstream sync checklist

1. Read `AGENTS.md`, `docs/upstream-sync.md`, and this file.
2. Ensure `git status --short --branch` is clean.
3. `git fetch upstream --prune`.
4. Review `git log --oneline HEAD..upstream/main` for upstream changes.
5. Merge `upstream/main` into the current branch.
6. Resolve expected conflict areas using this file:
   - package names and repository URLs;
   - plugin skill counts and skill files;
   - `src/mcp/standalone.ts` resource/prompt handlers;
   - Docker/local deployment files.
7. Review operator-visible changes from upstream:
   - env vars;
   - ports/bind hosts/CORS/CSP/host allowlists/auth;
   - Docker/compose/entrypoint/volume changes;
   - runtime dependency pins, especially `iii-sdk`.
8. Run `npm test` and `npm run build`.
9. Commit the merge and push to `origin/main`.
10. Update this document if a fork delta is added, removed, or absorbed upstream.

## When a fork delta can be dropped

A fork-specific patch can be removed only when one of these is true:

- upstream implements equivalent behavior and tests cover the fork use case;
- the user explicitly chooses upstream behavior over the local fork behavior;
- the feature is obsolete and docs/tests/package metadata are updated together.

When dropping a delta, update the commit ledger above so future syncs do not
reintroduce it accidentally.
