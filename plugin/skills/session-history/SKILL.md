---
name: session-history
description: Show recent agentmemory sessions and what happened in past work. Use when user asks "what did we do last time", "session history", "past sessions", or wants an overview of previous agent activity. For current project facts, prefer project docs as the source of truth after using session history as a pointer.
---

Fetch recent session history using `memory_sessions` with a meaningful limit, typically 20.

Present sessions in reverse chronological order:
- Show session ID (first 8 chars), project, start time, and status.
- Show total observation count per session.
- Surface key highlights: type + title, and summaries/key decisions when available.
- Mark likely project-documentation pointers separately from user/agent preferences.

Source-of-truth policy:
- Use session history to answer "what happened" and "where did we leave off".
- For project-specific decisions or architecture, read the referenced project docs before stating current truth.
- If a session says a project decision was made but no docs were updated, present it as historical context, not authoritative project documentation.

Do not make up sessions. Only show what the MCP tool actually returned.

If `memory_sessions` isn't available, tell the user to check plugin enablement, restart the agent client, and verify `/mcp` connectivity.
