# Upstream Sync

When the user asks to sync with upstream in this checkout, use the actual remotes:

- `origin` is the user's fork: `NightWatcher314/agentmemory`.
- `upstream` is the source project: `rohitg00/agentmemory`.

Also read `docs/fork-delta.md` before merging; it lists intentional fork-only features that should be preserved.

Use this workflow:

1. Check the current branch and worktree status.
2. Fetch `upstream`.
3. Merge `upstream/<current-branch>` into the current branch.
4. Resolve conflicts without discarding local user changes.
5. Review upstream changes for breaking configuration changes before finishing:
   - New or changed environment variables.
   - Changed default ports, bind hosts, CORS, CSP, Host allowlists, authentication, or other security gates.
   - Changed Docker, compose, entrypoint, deployment, or persistent-volume behavior.
   - Changed runtime dependencies or required external services.
6. If a breaking or operator-visible config change exists, summarize it for the user and update local config or docs when appropriate.
7. Complete the merge commit when needed.
8. Push the resulting current branch to `origin/<current-branch>`.

Do not push to `upstream` unless the user explicitly asks for that.
