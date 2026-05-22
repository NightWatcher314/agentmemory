---
name: document-project-memory
description: Persist, create, reorganize, or remove project-specific development documentation in the repository instead of agentmemory. Use when the user says to document, write down, preserve, remember, 沉淀, 整理, clean up, reorganize, delete, or remove project decisions, architecture, domain context, TODOs, runbooks, implementation notes, or other project facts that should live with the code in docs/, CONTEXT.md, README, AGENTS/CODEX guidance, or the project's existing documentation structure.
---

The user wants to maintain project-specific knowledge in local docs: $ARGUMENTS

Principle: project docs are the source of truth for project development knowledge; agentmemory is only an index/reminder layer for user preferences and cross-session retrieval.

Scope:
- You may create new documentation files when no good target exists.
- You may edit existing documentation when a suitable target exists.
- You may reorganize/split/merge documentation when it improves discoverability or removes duplication.
- You may delete obsolete documentation only when the user asks for cleanup/removal or when replacement/migration is clear. Never delete docs silently.
- Follow the project's existing documentation structure first; the filenames below are conventions, not hard limits.

Workflow:
1. Identify the project root. Prefer the current working directory's git root. If the user references another repo/path, use that.
2. Inspect existing docs before deciding: `CONTEXT.md`, `README.md`, `AGENTS.md`, `CODEX.md`, `.agents/`, `docs/`, and any existing roadmap/runbook/ADR/development files.
3. Classify the knowledge and choose the best target:
   - Domain vocabulary, module map, enduring context: existing context docs, often `CONTEXT.md` or `docs/domain/`.
   - Architecture decision with alternatives/tradeoffs: existing ADR location, often `docs/adr/YYYY-MM-DD-short-title.md`.
   - Operational/deployment procedure: existing runbook/deployment docs, often `docs/runbook.md` or `docs/deployment.md`.
   - Project TODO/roadmap/implementation queue: existing issue/roadmap/TODO docs, often `docs/todo.md` or `docs/roadmap.md`.
   - Coding/testing conventions: contributor or development docs, often `docs/development.md`, `docs/testing.md`, `AGENTS.md`, or `CODEX.md`.
   - Agent-specific project guidance: existing agent guidance files such as `AGENTS.md`, `CODEX.md`, `.agents/*`, only when the knowledge is specifically for agents.
4. Choose the operation:
   - Create: add a focused new file with a clear name when no existing file fits.
   - Update: append or revise the smallest relevant section.
   - Reorganize: split large mixed docs, merge duplicates, rename unclear files, and update links/references.
   - Delete: remove stale/duplicated docs only after preserving still-valid content elsewhere or confirming it is obsolete.
5. Write concise, reviewable documentation:
   - Include date when documenting decisions, TODOs, migrations, or deprecations.
   - Separate facts, decisions, rationale, consequences, and open questions.
   - Avoid secrets, raw tokens, and machine-local credentials.
   - Prefer bullets and small sections over long prose.
6. Maintain `AGENTS.md` as the agent-facing documentation index. Create it if missing, or update its docs index if present, so future agents know to consult project docs without the user repeating it. Keep this index concise and link to canonical docs such as `CONTEXT.md`, `docs/architecture.md`, ADRs, runbooks, testing docs, and TODO/roadmap docs.
7. If future agents should discover the docs through agentmemory, ask or save only a short pointer memory such as: "For project X, authoritative architecture context lives in AGENTS.md and CONTEXT.md". Do not duplicate the full project knowledge into agentmemory.
8. Report changed, created, moved, and deleted files with a brief rationale.

Deletion/reorganization safety:
- Before deleting or moving a doc, inspect its content and check for references where practical.
- Preserve unique still-valid information by moving it to the new canonical location.
- If uncertain whether a doc is obsolete, ask the user instead of deleting.
- Prefer git-visible changes over hidden state; do not use agentmemory as the only record of a removed project fact.

AGENTS.md docs index pattern:

```markdown
# Agent Guide

## Start here
- Read `CONTEXT.md` for the project overview and domain vocabulary.
- Read `docs/architecture.md` for system structure, if present.
- Read `docs/development.md` and `docs/testing.md` before changing code.

## Documentation map
- `CONTEXT.md` — canonical project context.
- `docs/adr/` — architecture decisions.
- `docs/runbook.md` — operations and deployment notes.
- `docs/todo.md` — active project follow-ups.

## Agent rules
- Prefer updating project docs over storing project facts only in agentmemory.
- If docs and memory disagree, treat docs as authoritative and mention the conflict.
```

ADR template:

```markdown
# YYYY-MM-DD: Decision title

## Status
Accepted | Proposed | Superseded

## Context
Why this decision is needed.

## Decision
What we will do.

## Consequences
Benefits, tradeoffs, risks.

## Open questions
- ...
```

TODO template:

```markdown
# Project TODO

## Active
- [ ] Item — context, owner/date if known.

## Backlog
- [ ] Item.

## Done
- [x] Item — completed date if known.
```

If the user explicitly says "remember in agentmemory" for project facts, warn that docs are preferred, then either (a) write docs and save a pointer memory, or (b) if they insist, save a concise memory with file references.
