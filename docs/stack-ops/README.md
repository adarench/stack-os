# Stack OS — source-of-truth docs

This directory is the single place where the project explains itself to humans
and agents. Git tells you what changed; these docs tell you **why** it changed,
**what phase** it belongs to, **what state** the feature is in, **what's been
validated**, and **what's blocked**.

## Mission

Replace the day-to-day Trello + AppFolio maintenance workflow at Stack Real
Estate with an internal Maintenance + Compliance Operating System. Mobile-first
PWA. Not a rebuild of AppFolio. Not an accounting system.

## Index

| Doc | Purpose |
|---|---|
| [`ROADMAP.md`](./ROADMAP.md) | Phase table, current focus, blocked items |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Stack, services, RLS model, identity, deploy, runbook |
| [`DATA_MODEL.md`](./DATA_MODEL.md) | Tables, polymorphism, ASCII ERD, indexes |
| [`WORKFLOW_STATES.md`](./WORKFLOW_STATES.md) | State machines per entity |
| [`AGENT_LANES.md`](./AGENT_LANES.md) | Agent ownership, lanes, handoff protocol |
| [`DECISIONS.md`](./DECISIONS.md) | ADR-lite for architectural decisions |
| [`CHANGELOG.md`](./CHANGELOG.md) | Feature-state changelog (NOT a git diff) |
| [`VALIDATION.md`](./VALIDATION.md) | What has been validated, by whom, with what evidence |
| [`OPEN_QUESTIONS.md`](./OPEN_QUESTIONS.md) | Unresolved questions and blockers |

## Discipline rules

- Every PR updates at least one doc (`CHANGELOG.md` minimum).
- Every architectural decision gets a numbered ADR in `DECISIONS.md`.
- Open questions older than 48h escalate in the next daily sync.
- Stale docs are bugs — fix them in the same PR or file an issue.
- These docs are feature-/roadmap-level. Implementation detail belongs in code
  comments and PR descriptions.

## Before-coding read list (every agent, every task)

1. `AGENT_LANES.md` — confirm lane and what's out of scope.
2. `/contracts/*.ts` — reuse existing types and state machines.
3. `DATA_MODEL.md` — don't duplicate tables.
4. `OPEN_QUESTIONS.md` — don't re-ask answered things.
5. `ROADMAP.md` — confirm phase and deliverable being addressed.
