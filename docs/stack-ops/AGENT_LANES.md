# Stack OS — Agent lanes

**Owner:** human (orchestrator) · **Update freq:** rare (when roles or directories change)

Concurrent agents:
- P0–P2: 3 (Schema & Backend, Frontend & Mobile UI, Infra & DX)
- P3+: 4 (add Workflows & Jobs)
- P4+: optional 5th (QA / Test Validator on-demand at phase gates)
- **Hard cap: 5**

## Lanes

### 1. Schema & Backend Agent (always running)

| Owns | Must NOT touch |
|---|---|
| `/db/**` | `/web/src/app` UI pages |
| `/contracts/**` | `/web/src/components` |
| `/web/src/app/api/**` | `/inngest/**` |
| `/web/src/lib/server/**` | docs other than `DATA_MODEL.md`, `WORKFLOW_STATES.md` |

Handoff format: PR with schema diff + contract types + migration + integration test.

Validation checklist:
- Drizzle migration applied
- RLS test passes
- Integration test on Neon dev branch
- No kind-aware queries (use status / type fields properly, no string sniffing)
- Contract types exported

Useful: every phase. Overkill: never.

### 2. Frontend & Mobile UI Agent (P1+)

| Owns | Must NOT touch |
|---|---|
| `/web/src/app/(routes)/**` | `/db/**`, `/contracts/**`, `/inngest/**` |
| `/web/src/components/**` | RLS, server actions |
| `/web/src/styles/**` | Schema |
| PWA assets in `/web/public/**` | |

Handoff format: PR with mobile + desktop screenshots + Playwright snapshot.

Validation checklist:
- Typecheck passes
- Lighthouse mobile > 80
- No untyped props
- Tested on real phone or device emulator

Useful: P1 onward. Overkill: P0.

### 3. Infra & DX Agent (P0 heavy, then on-demand)

| Owns | Must NOT touch |
|---|---|
| `/scripts/**`, `/.github/**` | Feature code |
| `vercel.json`, `package.json` | Schemas |
| `/test/setup/**` | |
| Infra sections of `ARCHITECTURE.md` | |

Handoff format: green CI + deploy preview + runbook update.

Validation checklist:
- CI passes
- Preview live
- Secrets verified
- Rollback procedure documented

Useful: P0 setup; on-demand for tooling/CI/migrations. Overkill: P1–P2 if no
infra change — pause and reassign to QA.

### 4. Workflows & Jobs Agent (P3+)

| Owns | Must NOT touch |
|---|---|
| `/inngest/**` | Schemas (request via Schema Agent) |
| `/web/src/lib/notifications/**` | UI pages |
| `/web/src/lib/scheduling/**` | |

Handoff format: Inngest function + replay test + idempotency key documented.

Validation checklist:
- Replay test passes
- Dry-run cron
- Notification prefs respected
- Rate limits respected

Useful: P3 onward. Overkill: P0–P2.

### 5. QA / Test Validator Agent (on-demand at phase gates)

| Owns | Must NOT touch |
|---|---|
| `/test/integration/**` | Implementation code (only writes tests) |
| `/test/e2e/**` | |

Handoff format: failing test → owning agent fixes → re-run.

Useful: end of each phase. Overkill: continuous (creates test churn ahead of
feature stability).

## Roles considered and rejected

- **Docs/changelog agent:** always lags reality. Active agents update docs in
  their own PRs.
- **Release manager agent:** Vercel preview + manual promote is enough at this
  scale.
- **Notification/files split:** folded into Workflows & Jobs.

## Orchestration protocol

- Each agent reads `AGENT_LANES.md` and `/contracts/*.ts` before writing code.
- Schema PRs merge first; other agents wait.
- Daily 5-line written sync at the top of `CHANGELOG.md` ("Daily" section):
  what shipped, what's blocked, what's next.
- Every PR cites phase + lane + deliverable from `ROADMAP.md`.

## Branch naming

`<phase>/<lane>/<feature>` — e.g. `p1/backend/work-orders-crud`,
`p1/ui/wo-detail-mobile`, `p3/jobs/recurring-spawn`.

## Per-task brief format (orchestrator → agent)

```
Phase: P1
Lane: Backend
Deliverable (from ROADMAP.md): work_orders CRUD
Files in scope: /db/schema/work-orders.ts, /web/src/app/api/work-orders/*, /contracts/state-machines/work-order.ts
Files OUT of scope: any UI page, any other schema
Done when: integration test passes, RLS scoped, contract type exported, CHANGELOG updated
```
