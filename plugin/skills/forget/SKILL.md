---
name: forget
description: Delete specific observations, memories, or sessions from agentmemory. Use when user says "forget this", "delete memory", or wants to remove specific data from agentmemory for privacy. This does not delete project documentation; if project docs need edits, update the repo files separately.
---

The user wants to remove data from agentmemory: $ARGUMENTS

Important: deletion is destructive. Always confirm with the user before deleting.

Scope policy:
- This skill deletes data from agentmemory only.
- It does not edit `CONTEXT.md`, `docs/`, ADRs, TODO files, or other repository documentation.
- If the user wants project docs changed, edit those files separately and make the git-visible change explicit.

Steps:
1. Search for matching observations/memories with `memory_smart_search`; use the user's input as `query` and `limit: 20`.
2. Show what was found: session IDs, observation/memory IDs, titles, timestamps, and type.
3. Ask for explicit confirmation listing the exact IDs to delete.
4. Once confirmed, call the available delete/governance MCP tool with the selected memory IDs and a short reason. If the tool only deletes by memory ID, collect every ID in a session before deleting a session's data.
5. Confirm deletion count and remind the user that repository docs were not changed.

Never delete without explicit user confirmation.

If deletion tools are unavailable, tell the user the MCP server or governance tool is unavailable and provide the usual plugin/MCP restart checks.
