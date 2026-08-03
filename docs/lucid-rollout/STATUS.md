# Lucid Rollout — Status

**Executive control surface. Update this in the same change that materially moves any requirement.**

- **Overall state:** **Live in production, pre-pilot** — `redesign/operator-shell` @ `eef139d`, deployed
  2026-07-29 (Vercel `stack-gufcqqcpv`), aliased to stack-os-six.vercel.app. **Credential auth is ON**
  (email+password for operators, technicians, and tenants; Google hidden on both sign-in pages — verified
  live). Migrations `0000`–`0021` applied to prod. A strict **evidence-based verification pass (2026-07-29)**
  replaced the earlier broad "live/done" claims with graded status — full detail in
  [`VERIFICATION_REPORT.md`](./VERIFICATION_REPORT.md). **Bottom line:** tenant login + transactional email are
  **production-verified**; **no operator/technician has ever logged in** (Oscar/Fernando accounts exist,
  `last_login` NULL); web push is wired + configured but **runtime-unverified**; native iOS push is **not
  implemented**; the iOS app is **source-only** (never built). **Not yet in pilot.**
- **Rollback target:** Vercel promote the prior deployment on this branch; migrations 0018–0021 additive → no schema revert.
- **Current milestone:** **Live; pre-pilot hardening.** Recent: onboarding, auth-reset (credential auth live),
  verification pass + fixes (OAuth-role authz, notification routing, CSP, RLS). **Next:** a real person logs in
  as Oscar/Fernando and as a Lucid tenant on a physical phone (turns Auto-verified → User/Device-verified);
  Apple enrollment for the native iOS track.
- **Last updated:** 2026-08-02
- **Prod DB schema note:** migrations **0014–0021** are applied to the shared `neondb` (all additive/reversible;
  0018 reset cols · 0019 rate_limits + auth_events · 0020 email uniqueness · 0021 must_change_password).
  `stack_os_ci` mirrors it and is the isolated target for the automated suite.
- **Production:** https://stack-os-six.vercel.app · **Branch:** `redesign/operator-shell` · **Prod commit:** `eef139d` (deployed 2026-07-29, `stack-gufcqqcpv`)
- **Docs:** this folder (`docs/lucid-rollout/`) · IDs in [`REQUIREMENTS_TRACKER.md`](./REQUIREMENTS_TRACKER.md) · audit in [`VERIFICATION_REPORT.md`](./VERIFICATION_REPORT.md)

## Verification status (2026-07-29)

Graded per the vocabulary in [`VERIFICATION_REPORT.md`](./VERIFICATION_REPORT.md). "Live" is never used
without an environment + channel + verification level. **Auto-verified = a passing automated test; it is
not the same as a real person doing it in prod.**

| Capability | Level | Evidence |
|---|---|---|
| Tenant email+password login | **Production-verified** | 3 Lucid accounts (Sam, Ben, Janet) with real sign-in timestamps Jul 22–23 |
| Operator / technician login | **Provisioned, not user-verified** | accounts + passwords exist; `last_login` NULL for **all** staff — Oscar/Fernando have never logged in |
| Transactional email (reset + invite) | **Production-verified (delivered)** | Resend log: reset Jul 28 + invite Jul 29, both `delivered` from `ops@stackstorage.us` (domain verified) |
| Credential UI (Google hidden) | **Production-verified (unauth)** | `curl` of `/sign-in` + `/tenant/sign-in`: password field present, Google absent, forgot-password present |
| Full WO loop (submit→assign→complete→notify→reopen) | **Auto-verified** | `at-canonical` + m2/m4/m5 integration tests; **not** re-run on a real device this pass |
| RLS cross-tenant isolation | **Auto-verified + CI-enforced** | `rls`/`tenant-rls`/`auth-matrix` pass as `app_user`; `rls-coverage` fails CI if any table lacks RLS |
| In-app (inbox/bell) | **Production-verified (staff)** | real `dispatchInline`→`loadInbox`/`loadInboxSummary` exercised against the **prod DB** 2026-07-29: in_app row written, surfaced with WO ref + unread count (`inbox-inapp.test.ts`). Staff-only; UI bell needs a staff login to see. |
| Web push (browser) | **Automated + configured; not device-verified** | `web-push-send.test.ts` (6) drives the real send path (payload shape, subscription, 410→prune, dispatcher fan-out w/ deep link); VAPID set in prod; deep-link + logout-cleanup fixed; real on-device delivery still not observed; vendor push not wired |
| Native iOS push (APNs) | **Code-complete, stub-until-keyed** | `tenant_device_tokens` + `apns.ts` (ES256 JWT/HTTP2) + register route + dispatcher fan-out + `NativePushRegister` shipped 2026-07-30; **no-op until an Apple `.p8` key is set** (then live, no code change); delivery needs key + device (IOS_APP.md §8) |
| SMS / MMS (Twilio A2P) | **Production-verified (delivered, on device)** | Full WO lifecycle texted to a real phone 2026-08-01 (submit→scheduled→in_progress→resolved→verified→closed), real Twilio SIDs; branded body + role deep link + STOP; MMS attaches resident photos (JPEG/PNG/GIF, HEIC/video excluded). Gated per-emit on a phone → key-events-only. Sender "STACK OS" on the approved Fresno number |
| iOS app | **Generated + pods resolved** | `cap add ios` now generates the Xcode project + `pod install` resolves (config-parse bug fixed); **build blocked on full Xcode.app** (this Mac has only CLT) |

## Shipped since M0–M10 (2026-07-28 → 07-30)
- **Technicians get the full console (2026-07-30, LR-014):** client feedback — Oscar/Fernando were bounced to
  the stripped-down `/tech` portal while Jen (admin) had the whole cockpit. `technician` is now a job, not a
  reduced access tier: new `hasConsoleAccess` gate (all staff roles) drives `/` routing + the admin server
  actions, `/` lands every staff member on `/my`, and the `(tech)` routes survive only as the one-job view
  that notification deep links open (with a "Full console →" way out). `OPERATOR_ROLES` keeps its old
  membership but is now *only* the `notifyOpsTeam` fan-out list, so the "email all of us except the tech whose
  job it is" rule is unchanged. **No role data change** — coverage/auto-routing/SMS dispatch still key off
  `technician`. Widens admin actions (add person, reset password, deactivate) to techs — accepted for a small
  internal team; see LR-014's revisit trigger.
- **Mobile & push sprint (2026-07-29, prod `13b9193`):** two audits (tenant mobile UX +
  web-push end-to-end) → fixes: iOS zoom-on-focus (16px inputs), `viewport-fit=cover`
  (safe areas now active), tenant loading skeletons, silent-failure errors on
  send/confirm/reopen, installed-PWA `start_url` routes tenants to `/tenant`. **Web push:**
  tenant notification tap now opens the deep-linked WO; push no longer leaks on logout
  (staff + tenant unsubscribe). **iOS:** `typescript` dep fix → `cap add ios` generates the
  Xcode project + `pod install` resolves; native-push design in IOS_APP.md; matrix in
  [`NOTIFICATION_ARCHITECTURE.md`](./NOTIFICATION_ARCHITECTURE.md). `tenant-push-unsubscribe.test.ts`; suite 291/291.
- **Auth reset — credential auth LIVE:** individual email+password for all three actor types; Google hidden
  behind `CREDENTIAL_AUTH`; tenant-auth failure root-caused (empty `STACK_ORG_ID` — org now resolved from
  email) and fixed (also unblocked tenant photo upload). `bcrypt` (cost 12), per-account lockout, per-IP rate
  limit, generic errors, auth audit events. Migrations 0018–0021 applied to prod.
- **Onboarding (M20):** admin "Send invite" (branded set-password link, no shared secret) + force-change-on-
  first-login fallback (`must_change_password`, migration 0021). Invite flow **production-verified** (Jul 29
  delivery + `invitation_issued` audit row).
- **Evidence-based verification pass** → [`VERIFICATION_REPORT.md`](./VERIFICATION_REPORT.md): reclassified every
  prior "live/done" claim; found 7 defects.
- **Fixes shipped (all deployed, with tests):**
  - **D2+D3 authz** — OAuth (Google) operators had `role=null` and 6 admin mutations were email-allow-list-only.
    `resolveStaffRole` reads role from the DB (subject or email); `assertOperator` gates all six. `authz-role-resolution.test.ts`.
  - **D7 notifications** — status changes now reach the assigned technician (not just the creator); tenant WOs
    with no assignee fall back to ops; no double-pings. `d7-notify-routing.test.ts`.
  - **D4 CSP** — `Content-Security-Policy-Report-Only` shipped (report-only; enforce+nonces later). Verified live.
  - **D5 RLS** — `auth_events` `user` actor scoped to its own org (system/inngest stay broad). Applied to prod + live-verified.
  - **D6 RLS coverage** — `rls-coverage.test.ts` fails CI if any public table lacks ENABLE/FORCE/policy.
- **Tests:** **290/290 across 50 files** on the isolated `stack_os_ci` DB (verified target, not prod).

## M0–M10 build record (through 2026-07-27)
- **M10 native evaluation — recommendation memo:** [`NATIVE_EVALUATION.md`](./NATIVE_EVALUATION.md).
  **Recommendation: ship the installable PWA for the pilot; defer native** (LR-010). Documents the
  one real gap (iOS push needs Home-Screen install), a mitigation (guided install), cost of native,
  and re-open triggers. No code — decision doc.
- **M9 external-vendor workflow (in review, not deployed):** `vendor-work-orders.ts` +
  `/vendor/[ref]` — a vendor_user now **opens an assigned WO's detail and messages** on it, all
  under `withVendorScope` so RLS (`work_orders_vendor_assigned`, `comments_vendor_external/insert`)
  is the boundary. Vendor comments are external-only (RLS-enforced). **Deferred (post-pilot):
  external-party status change / authoritative completion** — keeps the authoritative writer
  operator/tech-only. `m9-vendor.test.ts` (4: sees own detail + external msgs, never internal;
  posts a message; unassigned vendor blocked on read AND write). **261/261.** VEN-003 → In review.
- **M8 canonical acceptance test — authored as code (in review):** `test/integration/at-canonical.test.ts`
  runs the **full Lucid loop** green in CI against `stack_os_ci` — tenant submit → **auto-assign covering
  tech** → tech queue → acknowledge/start/**reply-to-requester**/internal-note → **authoritative complete**
  → tenant-safe completion summary → **reopen**, plus **cross-org isolation**. Asserts identity/attribution,
  the completion summary, the **internal-note boundary (no leak)**, and the audit trail — proving M1–M7
  compose. **257/257.** Remaining for *acceptance* (not code): run on **prod** with **real Lucid accounts +
  devices** + stakeholder sign-off. Other M8 items (security/RLS review sign-off, real-device, rollback
  rehearsal) remain process/human.
- **M7 push + installable PWA — launch gate (in review, not deployed):** generated the branded
  icon set (192 / 512 / maskable-512 / apple-touch-180) with a **zero-dependency** pure-Node PNG
  encoder (`scripts/gen-pwa-icons.mjs`); wired `manifest.webmanifest` + layout `icons`/apple-touch.
  `sw.js` + `tenant-sw.js` now **precache an offline shell + serve `offline.html`** on a failed
  navigation (network-first; **never caches authenticated HTML** — RLS safety); `ServiceWorkerRegister`
  registers the right SW **on every load** (not opt-in-only) → installable. `manifest.test.ts` now
  asserts the install contract (7 tests). **250/250.** PWA-001/002/004, PUSH-002 → In review.
  **Remaining gate: on-device install + web-push validation on real iPhone/Android + VAPID keys.**
- **M6 email notifications (in review, not deployed):** `email-templates.ts` — one branded,
  table-based, inline-CSS transactional shell + `absoluteUrl()` deep links (replaces bare
  `<p>${body}</p>`); **EML-004** staff status email now resolves the creator's address in-tx
  (was in_app-only); **EML-009** idempotency via `notifications.idempotency_key` + partial unique
  index (migration 0017) + per-channel dedupe. Inngest event now typed from `dispatchInline` (was
  dropping tenant/url fields). **247/247** (10 new). EML-004/008/009, → In review.
  **Remaining gate: verified Resend domain + `RESEND_API_KEY` for real delivery.**
- **M5 completion lifecycle + structured summary (in review, not deployed):** migration 0016
  (additive `work_orders.completion_summary` jsonb); `completion.ts` assembles a **deterministic**
  summary at completion (requester, location/floor/suite, technician, work-performed = internal
  notes, completion photos, timestamps) — read via existing WO RLS. **LIF-005** reopen clears
  `completedAt`; **LIF-007** blocking records `blockedReason`; **TEN-008** tenant sees a
  **tenant-safe** completion block (date + technician; no internal notes). **237/237 tests**
  (3 new: `m5-completion`). SUM-001/002, LIF-005/007, TEN-008 → In review.
- **M4 technician mobile workflow (in review, not deployed):** `lib/server/technician.ts`
  (queue / detail / actions, all guarded by "assigned to me") + a mobile `(tech)` surface
  (`/tech` queue, `/tech/[ref]` detail with acknowledge / start / block / **complete** /
  reply-to-requester / internal note); role-based landing routes technicians to `/tech`.
  Completion **reuses the authoritative `updateWorkOrderStatus`** (no redundant operator
  step, TEC-009). **234/234 tests** (5 new: `m4-technician` — queue scoping, detail authz,
  authoritative completion, external reply). Tech **photo upload UI** is the remaining sub-step
  (detail already shows photos). TEC-002…009, ADM-007 → In review.
- **M3 commercial model + fallback routing (in review, not deployed):** migration 0015
  (additive) — `floor`/`suite` on units, first-class `tenant_companies` (+ `tenant_users.company_id`),
  `org_settings` fallback assignee; routing chain **building tech → org fallback → never silently
  unassigned** (ASN-003/008); `commercial.ts` admin API; RLS on the new tables. **229/229 tests**
  (2 new: `m3-routing`). Pragmatic realization of LR-011 (property=building, unit=suite) — see
  DECISIONS impl note. **Technical blocker "fixed": system holds + routes Lucid's commercial data;
  real data entry is the remaining step** (CLIENT_INPUTS).
- **M2 confirmed-defect fixes (merged; not deployed):** **ASN-001** (resident WOs
  auto-assign the covering technician + audit), **MSG-001** (ops composer defaults
  to a requester-visible "reply to requester" on tenant WOs, labeled to avoid
  internal-note leaks), **MSG-010** (tenant messages stamp `tenantUpdatedAt`). 214/214 tests.
- **M1 credential auth (operator + technician), flag-gated behind `CREDENTIAL_AUTH`; merged (not deployed):**
  migration 0014 (additive credential columns on `users`/`tenant_users`); bcrypt hashing;
  login verifier with per-account lockout + generic errors + timing mitigation; NextAuth
  `password` provider + sign-in form; `technician` role + RBAC read. **225/225 tests**.
  Prod behavior unchanged (flag off). Next M1 sub-steps: tenant credential login, self-serve
  reset, invite→set-password UI, per-IP rate limit.
- **M0 shipped to production** (`1de22f22`, deploy `dpl_iZWj6h8w…`) — see `CHANGELOG_M0.md`.
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

## In progress / pending verification
- **Real-user login** for Oscar, Fernando, and a Lucid tenant on a physical phone — the loop is auto-verified
  but not yet User/Device-verified.
- **Web push** delivery — configured + wired, never observed end-to-end.
- Branch protection still plan-gated: the DB/RLS CI check runs green but isn't yet a *required* merge gate.

## Next actions
1. **Real-human validation (no Apple needed):** hand Oscar + Fernando their credentials; have each sign in and
   run a WO end-to-end on a real phone, and a Lucid tenant do the full submit→complete loop. This is the single
   biggest gap between "tested" and "proven."
2. **iOS track (blocked on Apple):** enroll Apple Developer (Meso ID) → `cap add ios` on a Mac → simulator →
   device build → APNs + TestFlight. See [`IOS_APP.md`](./IOS_APP.md) + VERIFICATION_REPORT §11–§12.
3. **Web push:** validate a real subscription + delivery on desktop and on a Home-Screen-installed iOS PWA.
4. Collect remaining Lucid inputs (buildings/routing/categories) — [`CLIENT_INPUTS.md`](./CLIENT_INPUTS.md).
5. Offered, not applied: CSP **enforce** step (per-request nonces); D1 local-env cleanup.

## Blockers
- **No real operator/technician login yet** — Oscar/Fernando provisioned but `last_login` NULL; needs the real
  people to sign in with their handed-over credentials.
- **iOS: an Apple Developer account (Meso ID) + a Mac with Xcode** — blocks build/sign/APNs/TestFlight/submission.
- **Physical devices + testers** — blocks Device/User verification of the mobile web + push flows.
- **Web push runtime** — configured but never observed delivering.

## Decisions needed
- **CSP enforce** — move from report-only to enforcing (needs per-request nonces for Next's inline scripts). When?
- **Migration-on-deploy strategy** (build-time vs gated release step) — currently manual (LR-013).
- Error-tracking vendor (Sentry) — optional; adopt now or stay on the Vercel-log baseline?
- Keep Google sign-in as an operator fallback (currently hidden but still wired) or remove it?
- _Resolved:_ hashing = **bcrypt cost 12** (shipped); credential auth = **on** for all three actor types.

## Client inputs needed
CI-01..03 (users/roles) for M1; CI-04..12 (techs/buildings/routing/categories) for
M2/M3; CI-13/14 (recipients/domain) for M6; CI-15 (VAPID/devices) for M7; CI-20
(pilot cohort) for M8. Full list + send-ready request in
[`CLIENT_INPUTS.md`](./CLIENT_INPUTS.md).

## Risks
First real operator/technician login untested (M) · native iOS/APNs not built, Apple-blocked (H) · web-push on
iOS Safari requires Home-Screen install (M) · commercial-data backfill (M) · routing-config completeness (M).
Email deliverability now **de-risked** (verified delivering to an external inbox). Mitigations in
[`ROADMAP.md`](./ROADMAP.md).

## Test summary
**290/290 across 50 files** on the isolated `stack_os_ci` DB (2026-07-29; verified target, not prod),
including `rls`/`tenant-rls`/`auth-matrix`/`rls-coverage` (RLS + coverage), `credential-auth`/
`authz-role-resolution` (authz), `d7-notify-routing`/`m6-email` (notifications), `onboarding`,
`password-reset`, and `at-canonical` (full loop). typecheck/lint/`lint:tokens`/build green. Playwright e2e
stays local. Physical-device + real-user passes are the remaining *acceptance* steps (not code).
> Harness note: a `&` in the Neon URL was breaking the isolated-DB env sourcing, so some earlier runs
> silently hit `neondb` (contained: unique `org_*` ids, cleaned up). Fixed + guarded; the 290/290 is a
> confirmed `stack_os_ci` run.

## Deployment summary
Prod on Vercel at `f8ba33c` (deployed 2026-08-02; aliased stack-os-six.vercel.app).
Deploy is manual `vercel deploy --prod --yes` (auto-deploy off) via a fast-forward push to
`redesign/operator-shell`. Migrations 0014–0022 applied to `neondb`; RLS policies re-applied idempotently
(`db:rls:apply`). Security headers live incl. `Content-Security-Policy-Report-Only`.

## Post-SMS iteration (2026-07-30 → 08-02) — deployed. Test gate **326/326**.
Incremental UX/admin + data-integrity pass on the live operator shell (no pipeline rewrite).
- **Admin › Assignments** — coverage-at-a-glance + inline per-building tech + org fallback; the data-driven
  routing source of truth (Sojo → Oscar, YONIQUE → Fernando is set here, not hardcoded). *(#1, #6)*
- **Operator conversation thread** — the requester-visible back-and-forth renders as a chat thread on a new
  Conversation tab in the WO drawer; reply inline (locked to requester-visible). Tenant messages now show the
  resident's real name, not the literal "tenant". *(#2)*
- **Complete WO metadata** in the drawer — assignee, requester (tap-to-call), category, waiting-on, and the
  full created/started/completed/updated timeline. *(#4)*
- **Tenant photos → tech MMS** — tech-facing texts attach the resident's still images (HEIC/video excluded,
  ≤10/5MB); best-effort, degrades to plain text + the tech's deep link. *(#5)*
- **"Waiting on" reason when blocking** *(#3)* — blocking a WO now asks what it's waiting on (resident /
  vendor / other), threading it to the row so the "Waiting on" field is real and the resident's text can say
  the actionable "Waiting on you". Was silently defaulting to "other".
- **Notification correctness** — verified + test-locked (`notification-matrix`): a resident's WO routes to
  **their** building's tech (never another's), every ops role gets the broadcast, techs don't, the resident is
  confirmed, uncovered buildings fall back. **Bug fixed:** `notifyOpsTeam` ignored account status, so
  deactivated staff kept getting broadcasts — now excluded.
- **Prod data cleanup (2026-08-01/02, owner-approved, full backup first):** deactivated 4 seed staff + revoked
  13 seed tenants; purged all seed/demo/test data down to the **9 real Lucid WOs** (Sam Lumpkins), 2 real
  buildings, 4 real tenants, 4 staff, and routing config (atomic + hard-guarded). Remodeled to the real
  structure: **Sojo** is the building; **Lucid** is a tenant company inside it (Sam/Ben/Janet). Ready for Jen
  to add current tenants.
- **Remaining:** Ben James & Janet need phone numbers for SMS (email/in-app works now); a real operator login
  to eyeball the drawer changes on-screen.

## Production-readiness hardening (2026-08-03) — deployed. Test gate **334/334**.
Closing the gaps from the four-agent readiness audit.
- **HEIC → JPEG on upload (ATT-006).** iPhone HEIC photos are transcoded to JPEG (via sharp, EXIF-rotated) on
  the tenant + tech upload paths, so they render on desktop Chrome/Firefox + Android, not just iOS Safari.
  Best-effort (an undecodable HEIC keeps its original bytes); mislabeled HEIC caught by magic-byte sniff.
- **Server-side MIME allowlist (ATT-007).** Uploads gated server-side (image+video on tenant/tech; +PDF on the
  staff/COI path); the bypassable client `accept=` is no longer the only filter. Non-allowed → 415.
- **Notification opt-out UI (PUSH-004).** New /settings page with per-channel toggles (email/text/push); the
  dispatch pipeline already honored `notification_preferences` — this adds the missing write side.
- **CSP enforced (SEC-005).** Report-only → enforced (object-src/base-uri/form-action/frame-ancestors/
  upgrade-insecure-requests now actively block). `script-src` keeps `'unsafe-inline'` for now — dropping it
  needs a nonce + forcing 18 prerendered pages (incl. public /privacy /support) dynamic, a browser-verified
  preview follow-up.
- **Never-unassigned guard (ASN-003/008).** Assignments page warns when a building has no tech AND no fallback
  is set (the live org has a fallback, so hidden there).
- **ADM-007 confirmed as intended (LR-014).** Owner decision: technicians are trusted internal staff and keep
  full console access incl. financials — not a gap, a product choice.

## Accepted requirements
**None formally accepted** (Accepted needs the canonical acceptance test run on prod with real accounts +
stakeholder sign-off). **Now production-verified** (one step below acceptance): tenant credential login,
transactional email delivery (reset + invite), and the credential-UI cutover (Google hidden). RLS boundary is
auto-verified **and** CI-enforced. Full grading in [`VERIFICATION_REPORT.md`](./VERIFICATION_REPORT.md).

## Outstanding launch blockers (P0)
- **Real operator/technician + tenant login on a physical device** — Oscar/Fernando have never logged in.
- **Push on real devices** — web-push delivery unproven; native iOS push not implemented.
- **iOS app** — source-only; blocked on Apple enrollment + a Mac.
- **AT-CANONICAL accepted on prod** with real Lucid accounts + stakeholder sign-off.
Code for the operator/web loop (AUTH/IDN/MSG/ASN/RBAC/LOC/TEC/SUM/EML) is **deployed**; the remaining
blockers are **verification + Apple/device, not code**. Live count in the tracker.

---
*Keep this concise; link to detail. One line per section update; move detail into
the referenced documents.*
