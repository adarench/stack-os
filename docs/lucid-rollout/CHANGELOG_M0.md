# M0 Release — Changes vs the Previous Production Version

**Deployed:** 2026-07-27 · **Deployment:** `dpl_iZWj6h8wMgMPqseNEkJLmwEqfmBj` → https://stack-os-six.vercel.app
**Previous prod commit:** `ba13375` · **Deployed commit:** `1de22f22` (merge of PR #2 into `redesign/operator-shell`)
**Commits:** `0ada9b0` (CI/observability/hygiene) · `49dea2b` (determinism + PWA audit) · `dfe85be` (docs)

M0 is a **baseline / hardening** release: CI, observability, and deploy hygiene. It is
**additive and behavior-preserving** — no database schema change, no migration, and no
change to any existing user-facing workflow. Post-deploy smoke: `/` → 307, `/api/health`
→ 200, **`/api/health/ready` → 200 `{status:"ok"}`** (new), `/sign-in` → 200.

---

## A. Runtime changes (these affect the deployed application)

| Change | File(s) | Effect in production |
|---|---|---|
| **New readiness probe** | `web/src/app/api/health/ready/route.ts` (new) | `GET /api/health/ready` → `200 {status:"ok"}` when required env is present, else `503 {status:"degraded"}` (missing **names** only in non-prod; a **count** in prod — never values). Liveness `/api/health` is unchanged. |
| **Global server-error capture** | `web/src/instrumentation.ts` (new) | Next.js `onRequestError` now routes uncaught server errors to the structured logger with a correlation id. Observability only — no behavior change to responses. |
| **Structured logger** | `web/src/lib/server/logger.ts` (new) | Dependency-free JSON logs to stdout/stderr (captured by Vercel), with redaction of secret-named keys, signed-URL query strings, and over-long values. |
| **Notification-attempt logging** | `web/src/lib/server/notifications.ts` (edit) | Two ad-hoc `console.*` calls in the dispatch fallback replaced with the structured logger. No change to notification behavior. |
| **Authorization-failure logging** | `web/src/lib/server/db.ts` (edit) | One PII-free `logger.warn("authz.operator_denied")` before the existing `/no-access` redirect in `withStaffScope`. No change to the auth/redirect behavior. |
| **Removed dead dependency** | `web/package.json`, `pnpm-lock.yaml` | `@clerk/nextjs` removed (it had **no runtime imports** — operator auth is NextAuth v5). Smaller dependency surface; no behavior change. |

**Not changed at runtime:** the demo `Credentials` provider (dev sign-in) is intact — **no
credential/password auth was added** (that is M1). Auth, RLS, the work-order state machine,
messaging/attachment/notification behavior, roles, and all UI are unchanged.

## B. Repository changes (no effect on the deployed application)

| Area | File(s) | Purpose |
|---|---|---|
| **CI pipeline** | `.github/workflows/ci.yml` (new) | On every push/PR: install(frozen) → typecheck → lint → `lint:tokens` → unit tests → build, + a committed-env guard. A gated **DB integration + RLS** job runs against an isolated `stack_os_ci` database (passing on PR #2). Not part of the app bundle. |
| **Deploy/secret hygiene** | `.gitignore`, `scripts/_prod-guard.ts`, `scripts/README.md`, `scripts/audit-workorders.ts` | Prod-write guard convention; 5 client-specific one-off scripts quarantined (git-ignored); `audit-workorders.ts` generalized into a committed read-only tool. |
| **Tests** | `test/unit/{logger,health-ready,manifest}.test.ts` (new), `test/integration/template-spawn.test.ts` (edit) | Focused tests for the logger/readiness/PWA-manifest; template-spawn reworked to be deterministic under the full suite. Tests are not deployed. |
| **Docs** | `docs/lucid-rollout/*` (12 planning/tracking docs + this changelog) | The Lucid rollout plan + tracking system. |

## C. Explicitly unchanged (regression surface)
- **Database:** no schema change, no migration ran against production `neondb`.
- **Auth/authorization:** no credential auth; NextAuth + magic-link behavior unchanged; RLS unchanged.
- **Work-order lifecycle, messaging, attachments, notifications, assignment:** behavior unchanged (only logging seams touched).
- **UI / routes / existing flows:** unchanged; the resident↔ops workflow is untouched.
- **Env/config:** no new required env; `APP_ENV` remains `development` in the Vercel prod env (pre-existing; cosmetic in the health payload).

## D. Verification
- CI green on PR #2 (Build & non-database tests + Database integration + RLS, 30 files / 212 tests incl. `rls`/`tenant-rls`).
- Local: typecheck/lint/`lint:tokens`/build green; 212/212 tests across 3 consecutive full-suite runs.
- Production smoke (post-deploy): `/` 307 · `/api/health` 200 · `/api/health/ready` 200 `{status:"ok"}` · `/sign-in` 200.

## E. Rollback
Redeploy the previous production build (`ba13375`) via `vercel` (promote the prior deployment
or `git revert 1de22f22` on `redesign/operator-shell` then `vercel deploy --prod`). No schema,
data, or migration to unwind; uploaded files and audit history are untouched. The isolated CI
database `stack_os_ci` is independent and droppable with zero impact on production.
