# Stack OS

Internal Maintenance + Compliance Operating System for Stack Real Estate.

Replaces day-to-day Trello + AppFolio maintenance workflows. Mobile-first PWA. Not a rebuild of AppFolio. Not an accounting system.

## Quick start

```bash
nvm use
pnpm install
cp .env.example .env.local   # fill in values
pnpm db:migrate
pnpm dev
```

## Repo layout

```
/web                 # Next.js 15 app (App Router, RSC, server actions)
/db                  # Drizzle schema, migrations, RLS, seed
/contracts           # Shared TS types and state machines
/inngest             # Background jobs (recurring tasks, COI sweeps)
/scripts             # Ops scripts (migrate, seed, AppFolio sync)
/test/integration    # Real-DB integration tests
/test/e2e            # Playwright (P2+)
/docs/stack-ops      # Source-of-truth docs
```

## Source-of-truth docs

Start here: [`/docs/stack-ops/README.md`](docs/stack-ops/README.md)

- [`ROADMAP.md`](docs/stack-ops/ROADMAP.md) — phases, status, what's next
- [`ARCHITECTURE.md`](docs/stack-ops/ARCHITECTURE.md) — stack, services, RLS, identity
- [`DATA_MODEL.md`](docs/stack-ops/DATA_MODEL.md) — tables, polymorphism, ERD
- [`WORKFLOW_STATES.md`](docs/stack-ops/WORKFLOW_STATES.md) — state machines
- [`AGENT_LANES.md`](docs/stack-ops/AGENT_LANES.md) — agent ownership and handoff
- [`DECISIONS.md`](docs/stack-ops/DECISIONS.md) — ADRs
- [`CHANGELOG.md`](docs/stack-ops/CHANGELOG.md) — feature-state changelog
- [`VALIDATION.md`](docs/stack-ops/VALIDATION.md) — what's been validated
- [`OPEN_QUESTIONS.md`](docs/stack-ops/OPEN_QUESTIONS.md) — blockers, unknowns
