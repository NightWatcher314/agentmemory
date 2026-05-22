---
name: learn-codebase
description: Initialize or refresh project understanding by systematically reading a whole repository, optionally using subagents for parallel exploration, then creating or updating project-local documentation and lightweight agentmemory pointers. Use when the user asks to learn a codebase, onboard to a repo, read the whole repository, initialize project memory/docs, build codebase context, create/update CONTEXT.md, summarize architecture, or refresh docs after significant changes.
---

The user wants to learn or refresh understanding of a codebase: $ARGUMENTS

Principle: project-local docs are the source of truth for project knowledge. Use agentmemory only for user/agent preferences, cross-project lessons, or short pointers to canonical project docs.

Core outputs:
- Update or create project-local docs that help future humans and agents navigate the repo.
- Always create or update `AGENTS.md` as the agent-facing documentation index, so future models know where to look under `docs/` without the user repeating it.
- Prefer existing doc structure. Common outputs include `CONTEXT.md`, `docs/architecture.md`, `docs/development.md`, `docs/testing.md`, `docs/runbook.md`, `docs/adr/*.md`, `docs/todo.md`, `AGENTS.md`, or `CODEX.md`.
- Optionally save a short agentmemory pointer after docs are updated, e.g. "For project X, start with CONTEXT.md and docs/architecture.md".

Repository learning workflow:
1. Identify the repo root. Prefer `git rev-parse --show-toplevel`; otherwise use the current working directory or user-specified path.
2. Inventory the repo quickly:
   - Read top-level `README*`, `CONTEXT.md`, `AGENTS.md`, `CODEX.md`, package manifests, build config, and existing `docs/`.
   - Use file listing tools (`find`, `rg --files`, `git ls-files`) while excluding generated/vendor directories such as `node_modules`, `.git`, `dist`, `build`, `.next`, `coverage`, virtualenvs, and lockfiles unless relevant.
   - Identify languages, frameworks, entrypoints, modules, tests, scripts, deployment files, and data stores.
3. If the repo is non-trivial and the user permits parallelism, use subagents to accelerate exploration. The user has explicitly allowed subagents for this skill.
4. Synthesize findings into docs. Avoid dumping file-by-file summaries; produce navigable mental models and canonical references.
5. Create or update `AGENTS.md` with a concise docs index and agent navigation rules. It should point to `CONTEXT.md`, key `docs/` files, ADRs, runbooks, testing docs, and TODO/roadmap docs as applicable.
6. Validate docs against the repository by checking important paths, scripts, and claims.
7. Report changed files, key discoveries, open questions, and recommended next steps.

Subagent guidance:
- Use subagents only for bounded, independent exploration tasks that materially speed up understanding.
- Do not delegate the final synthesis; keep that local so the documentation is coherent.
- Give each subagent a narrow scope and ask for evidence: exact files, functions/classes, commands, and uncertainty.
- Suggested parallel slices:
  - Architecture/module map: top-level packages, boundaries, major data flows.
  - Runtime/deployment: Docker, compose, env vars, services, runbooks.
  - Build/test/dev workflow: package scripts, CI, test layout, lint/typecheck commands.
  - Domain model/API: important routes, schemas, database models, external integrations.
  - Frontend/UI: routes, components, state management, styling system.
- Ask subagents not to edit files unless explicitly assigned a disjoint documentation file. Prefer read-only exploration and local final doc edits.
- Avoid duplicate exploration: if one subagent covers backend APIs, another should not cover the same files unless verifying a specific risk.

Documentation routing:
- `CONTEXT.md`: compact canonical project overview: purpose, domain vocabulary, module map, key flows, invariants, where to look first.
- `docs/architecture.md`: deeper architecture, module boundaries, data flow, diagrams-as-text.
- `docs/development.md`: setup, commands, code style, common workflows.
- `docs/testing.md`: test types, how to run, fixtures, known gaps.
- `docs/runbook.md` or `docs/deployment.md`: deployment, operations, services, env vars, troubleshooting.
- `docs/adr/YYYY-MM-DD-title.md`: decisions with alternatives/tradeoffs.
- `docs/todo.md`: discovered documentation gaps, technical debt, or follow-up work.
- `AGENTS.md`: required agent-facing docs index and navigation rules. Keep general project truth in docs, but point future agents to the canonical docs from here.
- `CODEX.md`: optional Codex-specific guidance if the project already uses it; prefer `AGENTS.md` for shared navigation.

Recommended `AGENTS.md` shape:

```markdown
# Agent Guide

## Start here
- Read `CONTEXT.md` for project overview, domain vocabulary, and module map.
- Read the docs listed below before making non-trivial changes.

## Documentation map
- `CONTEXT.md` — canonical project context.
- `docs/architecture.md` — system architecture and data flow.
- `docs/development.md` — setup and development workflow.
- `docs/testing.md` — test strategy and commands.
- `docs/adr/` — architecture decisions.
- `docs/runbook.md` — deployment/operations.
- `docs/todo.md` — active follow-ups.

## Agent rules
- Prefer project docs as source of truth for project facts.
- Use agentmemory for user preferences, cross-project lessons, and pointers only.
- If docs and memory disagree, follow docs and mention the discrepancy.
```

Recommended `CONTEXT.md` shape:

```markdown
# Project Context

## What this project does

## System map
- `path/`: purpose

## Core domain concepts
- Term: meaning

## Key runtime flows
1. Flow name: entrypoint -> important modules -> outputs

## Development workflow
- Install:
- Run:
- Test:

## Documentation map
- `docs/...`: what to read next

## Open questions / gaps
- ...
```

Quality bar:
- Prefer concise, durable documentation over exhaustive summaries.
- Every important claim should be traceable to a file or command output.
- Do not store secrets or raw `.env` values in docs or agentmemory.
- Mark uncertainty explicitly instead of guessing.
- If docs already exist, improve and reorganize them instead of duplicating content.
- If documentation becomes large, split by topic and link from `CONTEXT.md`.

Agentmemory pointer policy:
- After updating docs, ask before saving a pointer unless the user already asked to initialize memory.
- Pointer memory should be short and contain file paths, not duplicated project knowledge.
- User preferences discovered during the session may be saved to agentmemory with the `remember` workflow if the user asks.
