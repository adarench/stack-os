# Lucid Rollout — Release & Rollout Checklist

**Owner:** engineering + orchestrator · **Update freq:** per release · **Use:** run this per production release; the full list gates the pilot go-live (M8).

Check each item ✅/❌/⏭ with evidence (PR, run, screenshot). A release does not
ship with any ❌ on a P0 line. Cross-refs: [`AUTH_SPEC.md`](./AUTH_SPEC.md),
[`ROADMAP.md`](./ROADMAP.md), [`ACCEPTANCE_TESTS.md`](./ACCEPTANCE_TESTS.md).

## Database & migrations
- [ ] Migration is **additive & reversible**; no destructive drop without a dual-read window.
- [ ] Migration applied to prod via the pipeline (OBS-005), not manually/ad-hoc.
- [ ] Backfill (LOC-007) verified row-count + spot-checked; dual-read fallback works.
- [ ] RLS policies added for any new table (ENABLE + FORCE; preserve ADR-006 `app_user`).
- [ ] `rls.test.ts` + `tenant-rls.test.ts` (+ new-table RLS tests) green on a Neon branch.

## Backward compatibility
- [ ] Existing resident↔STACK workflow still works (no regression to the demo loop).
- [ ] Feature behind a flag where behavior changes (`NEXT_PUBLIC_CREDENTIAL_AUTH`, surface flags).
- [ ] Old auth path (Google) still functions during the dual-provider window.

## Environment & secrets
- [ ] All required env vars present in Vercel (prod + preview): `DATABASE_URL(_UNPOOLED)`,
  `AUTH_SECRET`, credential/`SESSION_SIGNING_SECRET`, `S3_*`, `RESEND_API_KEY` + verified
  `RESEND_FROM_EMAIL`, `INNGEST_*`, `VAPID_*`, `NEXT_PUBLIC_APP_URL`, `APP_ENV`.
- [ ] **No secret in the repo, docs, logs, or client bundle** (SEC-006). Grep clean.
- [ ] `E2E_BYPASS_AUTH` is **unset** in production (SEC / `auth.ts:19`).
- [ ] Dead `@clerk/nextjs` dependency removed (SEC-007 — done: package.json + lockfile). Demo `Credentials` stub removal deferred to M1 (coupled to credential auth; removing now breaks dev sign-in).

## Credential & bootstrap
- [ ] Argon2id/bcrypt params tuned for the runtime; verify latency acceptable.
- [ ] Pilot accounts provisioned via invite→set-password; **no plaintext** anywhere.
- [ ] Rate-limit + lockout live on all credential endpoints (AUTH-004).
- [ ] Generic auth errors (no account-existence disclosure) (AUTH-008).
- [ ] Admin-assisted + self-serve reset verified (AUTH-005).

## Account & data setup
- [ ] Lucid users/roles imported (CI-01/02/03); individual identities (IDN-003).
- [ ] Buildings/floors/suites/companies imported (CI-05..08); tenants mapped (LOC-005).
- [ ] Building→tech routing + fallback configured (CI-09/10); no silent-unassigned (ASN-008).
- [ ] Oscar/Fernando real accounts (CI-04) can log in and receive work.
- [ ] Category list confirmed (CI-12).
- [ ] Prod-writing scripts (`invite-demo-tenants.ts` etc.) NOT run on this release.

## Security & authorization review
- [ ] Server-side authz verified for every new surface (not UI-only) (SEC-001).
- [ ] RBAC boundaries: tenant/technician/operator/vendor per the AUTH_SPEC matrix.
- [ ] Tenant/building isolation validated incl. LOC tables (SEC-004).
- [ ] Internal notes never reach tenants; no financial data to tenant/tech (MSG-005, ADM-007).
- [ ] CSP added/verified (SEC-005); security headers intact.

## Automated tests
- [ ] CI green (`.github/workflows/ci.yml`): install(frozen), typecheck, lint, `lint:tokens`, unit, production build (OBS-001).
- [ ] **Database-backed CI is NOT enforced** until ALL of: repo **variable** `CI_DB_ENABLED=true`, repo **secret** `CI_DATABASE_URL` (a **disposable** Neon branch — never prod/dev), and the `integration` job added to **branch protection**. Until then the integration job is **visibly skipped** (grey, not a green pass) and RLS/tenant-isolation is not gated by CI (known gap, LR-013).
- [ ] Playwright e2e run locally (`pnpm test:e2e`) — intentionally excluded from CI.
- [ ] New requirement tests present and green for everything moving to Ready-for-QA.

## Real-device tests
- [ ] Tenant + technician flows on real iPhone Safari **and** Android Chrome.
- [ ] Photo capture incl. HEIC (ATT-006); large-file rejection; retry.
- [ ] **PWA installable** (icons/manifest/SW) on iOS + Android (PWA-004) — launch gate.
- [ ] **Web push** received foreground/background/closed/expired/revoked on real
  devices (PUSH-005) — launch gate.

## Email / notification tests
- [ ] Resend verified domain; real inbox round-trip for each canonical-loop event.
- [ ] Staff status-change email actually sends (EML-004).
- [ ] Retry does not double-send (EML-009); delivery logged (EML-010).
- [ ] Deep links authenticated + scope-correct; no cross-tenant leak (EML-008).

## Observability
- [ ] Structured logs emitting with redaction (OBS-003 · `logger.ts`); uncaught server errors captured via `instrumentation.ts` `onRequestError`.
- [ ] Error-tracking vendor wired (OBS-002, optional) — manual: add `@sentry/nextjs`, set `SENTRY_DSN` env, call `Sentry.captureException` in `instrumentation.ts` `onRequestError`. No DSN is committed.
- [ ] Readiness probe `/api/health/ready` returns `200 {status:"ok"}` in the target env; liveness `/api/health` returns 200. (Deep DB/storage/email checks are OBS-004 / M8.)
- [ ] Notification/delivery log viewable.

## Backups & rollback
- [ ] Neon PITR/backup confirmed (OBS-007).
- [ ] Rollback runbook written + dry-run: flag off, migration reversibility, no file
  deletion, audit preserved.

## Production smoke tests
- [ ] Post-deploy smoke of the canonical loop (auth → submit → assign → message →
  complete → confirm) green (OBS-006).
- [ ] `/api/health` 200; no 500s on protected routes; RLS 404 on cross-org access.

## Pilot cohort & support
- [ ] Pilot cohort selected (CI-20); staged behind flags.
- [ ] Support owner + escalation path named; who fixes what during pilot.
- [ ] Users know how to report issues.

## Acceptance sign-off
- [ ] `ACCEPTANCE_TESTS.md` **AT-CANONICAL** passes on production with real accounts.
- [ ] Stakeholder signs off; P0 requirements moved to **Accepted** (owner + date) in
  the tracker; [`STATUS.md`](./STATUS.md) shows zero open P0 launch blockers.
