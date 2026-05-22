---
name: recall
description: Search agentmemory for past observations, sessions, user preferences, and cross-project learnings. Use when the user says "recall", "remember", "what did we do", "memory", asks for prior context, or needs context from past sessions. For project-specific facts, use agentmemory as an index and prefer citing the project's docs as the source of truth when available.
---

The user wants to recall past context about: $ARGUMENTS

Use `memory_smart_search` with the user's query and `limit: 10`.

Interpret results with this source-of-truth policy:
- Treat agentmemory as the source of truth for user preferences, agent workflow preferences, cross-project reminders, and private/local environment notes.
- Treat project documentation as the source of truth for project-specific development knowledge: architecture, ADRs, domain model, APIs, runbooks, TODOs, and implementation decisions.
- If a memory points to files such as `CONTEXT.md`, `docs/`, `docs/adr/`, `docs/runbook.md`, or `docs/todo.md`, read those local files before answering when the user asks for current project facts.
- If memory and docs disagree, tell the user and prefer the docs unless the user asks about historical memory state.

Present returned results in a readable format:
- Group by session or by memory type when the results are long.
- For each observation show its type, title, and available narrative/content.
- Highlight important results (importance or strength >= 7).
- Separate "agentmemory-only preferences" from "project docs pointers/facts" when relevant.
- If no results come back, suggest 2-3 alternative search terms.

Do not make up observations. Only present what the MCP tool or local docs actually contain.

If `memory_smart_search` isn't available, the stdio MCP shim didn't start — tell the user to:
1. Run `/plugin list` and confirm `agentmemory` shows as enabled.
2. Restart the agent client so the plugin `.mcp.json` is loaded.
3. Check `/mcp` to see whether the `agentmemory` MCP server is connected.
