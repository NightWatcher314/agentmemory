---
name: remember
description: Save durable user preferences, agent workflow preferences, cross-project lessons, and private/local environment notes to agentmemory. Use when the user says "remember this", "save this", or wants future sessions to preserve a preference. If the content is project-specific development knowledge, route it to project docs instead of long-term agentmemory unless the user explicitly asks for an agentmemory pointer.
---

The user wants to preserve: $ARGUMENTS

Classify before writing:

Save to `agentmemory` when the content is:
- User preference: communication style, tool preference, default behavior, personal workflow.
- Agent workflow preference: how the agent should act across sessions/projects.
- Cross-project lesson or reusable heuristic.
- Private/local environment note that should not be committed to a repo, e.g. token handling policy, local machine paths, deployment credentials metadata. Never store raw secrets.
- A pointer telling future agents where project docs live, when useful.

Do not save only to `agentmemory` when the content is project-specific development knowledge:
- Architecture decisions, domain model, API contracts, data model, deployment/runbook facts.
- Project TODOs, implementation plans, feature decisions, test strategy.
- Anything another contributor should review in git.

For project-specific content, use the `document-project-memory` skill/workflow: write or update local docs such as `CONTEXT.md`, `docs/adr/`, `docs/runbook.md`, or `docs/todo.md`. Optionally save a short pointer in agentmemory only when the user explicitly asks for cross-session discoverability or when future agents need to know which doc is authoritative.

When saving to `agentmemory`:
1. Extract the core insight, decision, or preference.
2. Extract 2-5 searchable `concepts` as lowercased keyword phrases.
3. Extract relevant `files` only as pointers; use absolute or repo-relative paths.
4. Choose a memory `type` when the tool supports it: `preference` for user/agent preferences, `workflow` for process, `fact` for environment notes, `architecture` only for cross-project architecture patterns.
5. Call `memory_save` with `content`, `concepts`, and `files`.
6. Confirm what was saved and why it belongs in agentmemory rather than docs.

If classification is ambiguous, ask one concise question: "Should this be a user/agent preference in agentmemory, or a project fact in docs?"

If `memory_save` isn't available, tell the user the agentmemory MCP server is unavailable and give the usual plugin/MCP restart checks.
