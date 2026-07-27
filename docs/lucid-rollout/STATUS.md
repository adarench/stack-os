# Lucid Rollout — Status

**Executive control surface. Update this in the same change that materially moves any requirement.**

- **Overall state:** **M0 engineering hygiene implemented — in review** (not merged/deployed). Not yet in pilot.
- **Current milestone:** M0 (baseline & decisions) · next: **M1 (credential auth — first slice)**
- **Last updated:** 2026-07-27
- **Production:** https://stack-os-six.vercel.app · **Branch:** `redesign/operator-shell` · **Prod commit:** `ba13375` (unchanged — M0 not deployed)
- **Docs:** this folder (`docs/lucid-rollout/`) · IDs in [`REQUIREMENTS_TRACKER.md`](./REQUIREMENTS_TRACKER.md)

## Completed this period
- **M2 confirmed-defect fixes (in review, not deployed):** **ASN-001** (resident WOs
  now auto-assign the covering technician + audit), **MSG-001** (ops composer defaults
  to a requester-visible "reply to requester" on tenant WOs, clearly labeled to avoid
  internal-note leaks), **MSG-010** (tenant messages stamp `tenantUpdatedAt`). 214/214
  tests (2 new integration); typecheck/lint/tokens/build green. PR vs `redesign/operator-shell`.
  *(M0 is deployed to prod; M1 credential auth is a separate in-review PR — overall-state
  header reconciled at merge.)*
- Repository-grounded audit + 12 control documents + 136 requirements (planning).
- **M0 implemented (in review):** CI workflow with an **honest, visibly-skipped** DB
  integration job; structured logger + `onRequestError`; `/api/health/ready`;
  `_prod-guard.ts` + committed-env CI guard; dead **`@clerk/nextjs` removed**;
  `audit-workorders.ts` generalized into a committed read-only tool; 5 one-offs
  quarantined (OBS-001/003 · partial OBS-002/004/005 · SEC-006 · SEC-007 partial).
- **Focused automated tests added:** `test/unit/logger.test.ts` (redaction, 6),
  `test/unit/health-ready.test.ts` (readiness, 4), `test/unit/manifest.test.ts`
  (PWA manifest baseline, 4).
- **PWA baseline audited — no M0 change:** `manifest.webmanifest` is valid JSON with
  **no broken references**; `sw.js`/`tenant-sw.js` exist and are correctly referenced.
  Missing icons/offline-cache/global-registration/installability are **M7** (launch
  gate, PWA-001/002/004), not M0 defects. Not installable today — do not infer
  installability from the manifest.
- **Test-suite determinism fixed:** `template-spawn.test.ts` asserted the org-wide
  `runDueTemplates()` global count (polluted by seed templates in the shared Neon
  branch); reworked to assert per-template fires. Now deterministic across full-suite
  runs (test-only change; no production behavior change).
- Gates green: typecheck ✓ · lint ✓ · `lint:tokens` ✓ · build ✓ · `--frozen-lockfile`
  consistent. **212/212 tests pass across 3 consecutive full-suite runs**
  (`pnpm --filter web test`) after the `template-spawn` determinism fix.

## In progress
- **DB-backed CI configured + passing on PR #2** (variable `CI_DB_ENABLED=true` + secrets
  `CI_DATABASE_URL`/`CI_DATABASE_URL_UNPOOLED` → an **isolated `stack_os_ci` database** on the
  authorized Neon endpoint; production `neondb` data untouched). Awaiting: human review/merge and
  branch protection (plan-gated) to make the DB check a *required* merge gate. Deferred: Clerk
  demo-stub removal (M1), Sentry vendor (manual), migration-on-deploy decision (LR-013).

## Next actions
1. Human review + merge PR #2 (draft); add branch protection so the DB check gates merges (plan-gated).
2. Collect Lucid inputs (users/buildings/routing/categories) — send the
   [`CLIENT_INPUTS.md`](./CLIENT_INPUTS.md) request block.
3. M1: credential auth + identity + RBAC (the approved first slice; separate implementation approval).

## Blockers
- **Branch protection is plan-gated** on this private repo — the DB integration/RLS check runs
  green on PR #2 but is not yet a *required* merge gate (needs GitHub Team/Pro or a public repo).
- **Client inputs** for M3 (buildings/floors/suites/companies/routing) — not yet requested. See CLIENT_INPUTS.
- **Infra unverified:** Resend prod domain (M6), VAPID keys + test devices (M7), Inngest prod keys.

## Decisions needed
- **Migration-on-deploy strategy** (build-time vs gated release step) — currently manual (LR-013).
- Error-tracking vendor (Sentry) — optional; adopt now or stay on Vercel-log baseline?
- Confirm Argon2id vs bcrypt on the Vercel runtime (M1) — recommend Argon2id.
- Confirm whether Google sign-in is retained as an operator convenience post-cutover (optional).

## Client inputs needed
CI-01..03 (users/roles) for M1; CI-04..12 (techs/buildings/routing/categories) for
M2/M3; CI-13/14 (recipients/domain) for M6; CI-15 (VAPID/devices) for M7; CI-20
(pilot cohort) for M8. Full list + send-ready request in
[`CLIENT_INPUTS.md`](./CLIENT_INPUTS.md).

## Risks
Auth cutover (H) · commercial-hierarchy backfill (M) · routing-config completeness
(M) · iOS push/PWA quirks (M) · email deliverability (M). Mitigations in
[`ROADMAP.md`](./ROADMAP.md).

## Test summary
212/212 tests pass locally (3 consecutive runs) **and in CI**: the DB integration + RLS job
runs against the isolated `stack_os_ci` database and passes (30 files / 212 tests, including
`rls.test.ts` + `tenant-rls.test.ts`). Non-DB CI (typecheck/lint/`lint:tokens`/unit/build) also
green (OBS-001). Playwright e2e stays local. **No full-loop acceptance e2e yet** — AT-CANONICAL
to be authored as code in M1–M8.

## Deployment summary
Prod on Vercel at `ba13375` (pre-rollout baseline) — **unchanged; M0 not deployed.**
M0 changes are additive, flag-free, and reversible (new files + additive log lines; no
schema, no behavior change). Deployment = Vercel git-push; migrations remain manual
(auto-apply-on-deploy deferred — LR-013).

## Accepted requirements
**None yet** (Accepted requires acceptance test + sign-off). Note: several
capabilities are **Deployed** (in prod) but not **Accepted** for Lucid — e.g. RLS
boundary, state machine, authoritative completion, COI. See the tracker.

## Outstanding launch blockers (P0)
Credential auth (AUTH-*) · individual identity (IDN-001) · **MSG-001** message
visibility · **ASN-001** tenant auto-assign · RBAC + technician role (SEC-002/003)
· commercial model + routing (LOC-*, ASN-*) · technician mobile workflow (TEC-*) ·
completion summary (SUM-001/002) · email (EML-*) · **push + installable PWA (PUSH-*,
PWA-*, launch gate)** · AT-CANONICAL accepted on prod. Live count in the tracker.

---
*Keep this concise; link to detail. One line per section update; move detail into
the referenced documents.*
