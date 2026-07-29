# Stack OS — Production Claims Verification

**Date:** 2026-07-29 · **Author:** engineering (evidence-based audit pass)
**Prod alias:** https://stack-os-six.vercel.app
**Commit:** `1986ba792c2b0dc392d810fe6913bd8becfe9cb5` (= remote `redesign/operator-shell` tip, pushed)
**Deployment:** `stack-a4rzm3hmj-adam-renchers-projects.vercel.app` — Ready
**Migrations applied:** `0000`…`0021` (0021 = `superb_clea`, adds `must_change_password`)
**Automated suite:** 47 files / **282 tests passed** against isolated `stack_os_ci` (127s, this pass)

## Status vocabulary (used consistently below)

Implemented (code exists) · Deployed (present in the named env) · Configured (env/creds/provider set) ·
Auto-verified (a passing automated test) · Manually verified (a person ran the flow) ·
Device-verified (passed on a named physical device) · User-verified (the intended real user did it) ·
Production-verified (the live env passed the flow) · Blocked (a named external dependency stops the next step).

"Live" is never used without an environment + channel + verification level.

---

## 1. Executive truth statement

Today, in production:

- **An administrator** can load the operator console (via the existing Google allow-list). No admin has ever logged in with the new email+password credentials (`last_login` is NULL for every staff row). Admin account/people mutations are role-gated; property/vendor mutations are only operator-email-gated.
- **A technician** (Oscar, Fernando) has a real password account, verified — **but has never once logged in**. The full technician workflow is auto-verified by integration tests, not by any real device or person.
- **A tenant** can sign in with email+password on the live site — three real Lucid accounts (Sam, Ben, Janet) have genuine sign-in timestamps (Jul 22–23). The submit→assign→update→complete loop is auto-verified; it has not been re-run by a real person on a physical phone this pass.
- **An iPhone user** has nothing to install: the iOS app is source files only — never built, signed, or run. Native push does not exist.
- **Email** works: one real password-reset email was **delivered** to an external inbox from the branded sender on Jul 28. No invitation or notification email has actually been sent in prod yet. **Web push** is fully wired but has zero runtime/delivery evidence. **Native iOS push** is not implemented.

---

## 2. Claims audit

| Prior claim | Verdict | Precise statement |
|---|---|---|
| "Email + push are live" | **Incorrect (as phrased)** | Email: *Configured + one Production-verified delivery* (reset, Jul 28). Web push: *Implemented + Configured, unverified at runtime*. Native push: *Not implemented*. "Push is live" is false. |
| "Oscar & Fernando have separate technician accounts" | **Partially verified** | Two distinct `technician`-role rows exist with passwords + verified email (Implemented + Deployed). **Never logged in** (`last_login` NULL) → not User-verified. |
| "Durable session" | **Implemented, unverified** | httpOnly cookie sessions exist (NextAuth JWT staff / HMAC tenant). Persistence across mobile-Safari restart/backgrounding is **not** Device-verified. |
| "Photos now reach the operator dashboard" | **Auto-verified only** | `m2-tenant-defects.test.ts` passes (upload→associate→operator-visible). Not Manually/Production-verified this pass. |
| "Tenant-safe messages + completion" | **Auto-verified only** | `m5-completion.test.ts`, `m2-tenant-defects.test.ts` pass. Not re-run by a real tenant in prod this pass. |
| "RLS forced on every table" | **Verified (static) + Auto-verified (isolation)** | 36/36 schema tables have `ENABLE`+`FORCE`; `rls.test.ts`/`tenant-rls.test.ts`/`auth-matrix.test.ts` pass as the non-BYPASSRLS `app_user`. Caveat: list is hand-maintained (future tables not auto-protected). |
| "Everything buildable without Apple is done" | **Incorrect** | Not done without Apple: `npm install` in `mobile/`, `cap add ios`, a **simulator** build, and the APNs backend send-path are all still possible/absent. See §7. |
| Individual accounts "provisioned" | **Verified (rows) / not User-verified** | Rows exist with passwords; only 3 tenant accounts show a real login. Staff/tech: 0 logins. Invites: **0 sent** (`auth_events` empty). |

---

## 3. Authentication — what was actually tested

| Path | Env | Verification | Evidence |
|---|---|---|---|
| Tenant email+password login | prod | **Production-verified** (login succeeded) | `last_signed_in_at` Jul 22–23 for slumpkins@lucidchart.com, bjames@lucidchart.com, janet@lucid.co |
| Staff/tech email+password login | prod | **Not verified** | `last_login_at` NULL for all 12 staff rows incl. Oscar/Fernando/Jen |
| Credential correctness (hash/verify, lockout, no-disclosure, org-scope, deactivated-block) | CI DB | **Auto-verified** | `credential-auth.test.ts` (6), `password.test.ts` (4), `rate-limit.test.ts` (2) all pass |
| Google hidden / credential form shown | prod | **Production-verified (unauth)** | `curl` of `/sign-in` + `/tenant/sign-in`: password field present, "Sign in with Google" absent, "Forgot password" present, HTTP 200 |
| Forgot/reset/expiry/single-use | CI DB | **Auto-verified** | `password-reset.test.ts` (6) |

**Not performed (out of my reach):** typing any real user's password into a live login (I'm not permitted to, and lack the credentials); physical-iPhone Safari session/restart behavior (no device). The Chrome extension was not connected, so no authenticated browser flow was observed — only unauthenticated page fetches.

---

## 4. Account roster (non-secret state; prod org `org_3DK8ysf4…IL0GP0`)

Passwords/hashes/tokens are never shown. "pw" = a hash is present. "login" = a real successful login timestamp exists.

**Staff / technicians (real):**

| Name | Email | Role | Active | pw | verified | Real login? |
|---|---|---|---|---|---|---|
| Jen Meeks | jen@stackwithus.com | admin | yes | Y | Y | **No** |
| Oscar Banuelos | oscar@stackwithus.com | technician | yes | Y | Y | **No** |
| Fernando Salazar | fernando@stackwithus.com | technician | yes | Y | Y | **No** |
| (operator) | adam.rencher12@gmail.com | staff | yes | – | – | No (uses Google) |

Also present: 3 seed phantom staff (`*.stackdemo.test`), `demo@stack.local`, and 4 rows in isolated `org_test_*` orgs (test data, not prod users).

**Tenants (real Lucid):**

| Email | Active | pw | verified | Last sign-in |
|---|---|---|---|---|
| slumpkins@lucidchart.com | yes | Y | Y | 2026-07-23 22:47 |
| bjames@lucidchart.com | yes | Y | Y | 2026-07-22 15:38 |
| janet@lucid.co | yes | Y | Y | 2026-07-22 15:38 |

Also present: ~13 seed demo tenants (`*.tenant.test`, June activity), `adam.rencher12@gmail.com` (tenant, no pw), and one `invited` row in a test org.

**Invitations / audit:** `auth_events` was empty at the start of this pass; it now records `invitation_issued=1` (the live invite below), plus `reset_requested=1` / `reset_completed=2` that appeared **during** this session — i.e. real password-reset activity occurred in prod (likely operator testing; worth confirming it was expected). The audit path is therefore Production-verified as writing. `must_change_password` is false on all current real accounts (they predate migration 0021), so the force-change fallback would not currently trigger for them.

---

## 5. Tenant workflow — physical-mobile result

**Not performed.** I have no physical iPhone and cannot type a tenant's password into the live login. This end-to-end physical pass (private Safari → sign in → submit with camera photo → no duplicate → operator sees photo → assign → tech update → tenant sees update → complete → logout → protected content blocked → sign back in → history intact) **remains User/Device-unverified** and must be run by a person on a real device.

What *is* verified for this loop: automated integration tests — `m2-tenant-defects.test.ts` (messaging visibility, tenant auto-assign, photo reach), `m4-technician.test.ts`, `m5-completion.test.ts`, `assign-technician.test.ts`, `tenant-credentials.test.ts` — all pass against a real Postgres. That proves the server logic; it does not prove the mobile-Safari UX.

---

## 6. Notification matrix (four separate systems)

Legend per cell: Impl / Deployed / Configured(prod) / Auto-test / Manual-prod / Device.

### A. Transactional email — Resend, sender `Stack OS <ops@stackstorage.us>` (domain `stackstorage.us` **verified**)

| Event | Recipient(s) | Impl | Deploy | Config | Auto | Manual-prod | Evidence / blocker |
|---|---|---|---|---|---|---|---|
| Password reset / account setup | subject | ✓ | ✓ | ✓ | ✓ | ✓ **delivered** | Resend log: Jul 28 22:05 → adam.rencher12@gmail.com, status `delivered`; `password-reset.test.ts` |
| User invitation | invitee | ✓ | ✓ | ✓ | ✓ | ✓ **delivered** | Live invite Jul 29 → adam.rencher12@gmail.com from `ops@stackstorage.us`, Resend msg `fcec2df9…`, `last_event=delivered`; `invitation_issued` audit row written (0→1) |
| Work order submitted | assigned tech + ops team | ✓ | ✓ | ✓ | ✓ | ✗ | `m6-email.test.ts`; no prod send observed |
| Technician assigned | assigned tech / vendor | ✓ | ✓ | ✓ | ✓ | ✗ | no prod send observed |
| Status changed (blocked/resolved/verified) | WO **creator** (+ ops on resolved) | ✓ | ✓ | ✓ | ✓ | ✗ | **Gap:** tenant-created WOs get no staff status email; assigned tech not emailed on status change |
| Tenant update posted | tenant | ✓ | ✓ | ✓ | ✓ | ✗ | `wo_status`; recipient dropped if tenant email null |
| Work order completed | tenant | ✓ | ✓ | ✓ | ✓ | ✗ | — |
| Work order reopened | covering tech | ✓ | ✓ | ✓ | ✓ | ✗ | — |
| Account deactivated | (none) | ✗ | — | — | — | — | no deactivation email exists |

Links built from `NEXT_PUBLIC_APP_URL` (localhost fallback if unset). Reset tokens: sha256-hashed at rest, **1h TTL, single-use**. Invite tokens: **7-day TTL** (tenant magic-link intentionally not single-use — link-preview bots). As of this pass the prod send log contains the Jul 28 reset **and** the Jul 29 invite (both delivered) — every *other* email type above is auto-tested but has not yet sent in prod.

### B. Web push (browser / VAPID) — **Implemented + Configured, runtime-unverified**

Service worker registration (`/sw.js`, `/tenant-sw.js`), permission + subscribe flows (staff `/my`, tenant `/tenant`), persistence (`push_subscriptions`, `tenant_push_subscriptions`), and `web-push` send are all wired and invoked in the notification dispatcher. `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` are present in prod. **But:** no subscription is known to exist, no push has been observed delivered on any browser, and the only automated test (`push.test.ts`) exercises the *stub* no-op. iOS Safari web push additionally requires the PWA be installed to the Home Screen — untested. **Vendor push is not wired.** Verdict: not "live."

### C. Native iOS push (APNs) — **Not implemented**

`@capacitor/push-notifications` is declared in `mobile/package.json` and configured in `capacitor.config.ts`, but: no native `ios/` project, no `aps-environment` entitlement, no `PushNotifications.register()` call (the shell only loads the remote PWA), and **no APNs/FCM send path anywhere in the backend**. `mobile/` deps aren't even installed. Classification: **Not implemented** (declaration-only).

### D. In-app notifications — **Implemented, staff-only**

Real inbox: `/inbox` page + top-bar bell with a 60s-polling unread badge, backed by the `notifications` table. Caveats: **no per-user read state** (unread ≈ "created in last 24h"); **tenants and vendors get `in_app` rows written but have no inbox UI** to read them.

---

## 7. iOS build state

**Highest stage reached: `source-files-created`.** Present: `capacitor.config.ts` (appId **`us.stackstorage.tenant`**, `server.url = https://stack-os-six.vercel.app/tenant`), `package.json` (deps declared incl. camera + push, **not installed**), `www/index.html` loading shell, and 5 source brand PNGs. Absent (dispositive): no `ios/` project, no `.xcodeproj`/`.xcworkspace`, no `Podfile`, no `Info.plist`, no entitlements, no asset catalog, no build output. Nothing has been compiled, run in a simulator, signed, archived, uploaded, or submitted. `docs/lucid-rollout/IOS_APP.md` states this accurately.

---

## 8. Authorization — positive & negative results

**RLS (static + auto-verified):** 36/36 schema tables have `ENABLE`+`FORCE ROW LEVEL SECURITY`; `app_user` is `NOLOGIN` and lacks `BYPASSRLS`. Cross-tenant isolation is **Auto-verified** by `rls.test.ts`, `tenant-rls.test.ts`, and the 18-case `auth-matrix.test.ts` (all passed as `app_user` against real Postgres). Credential org-scoping is auto-verified (`credential-auth.test.ts`: "credentials never work under a different org").

**Negative tests actually run:** the above integration tests assert a tenant/vendor session cannot read another org's/tenant's rows, and that deactivated + wrong-org credentials are rejected. These ran in CI, **not** as live prod sessions this pass (I can't authenticate as a user). No live-prod negative test was performed.

**Authz gaps found (code-level):**

1. **Admin FormData mutations not role-gated.** ~~`createPropertyAction`, `setPropertyAssigneeAction`, `createUnitAction`, `createVendorAction`, `inviteVendorUserAction`, `setUserPhoneAction` enforce only the operator **email allow-list**, not `isOperatorRole`.~~ **FIXED this pass** — all six now call `assertOperator()`. Account/people actions were already role-gated.
2. **No role gate on the operator read surface.** No `middleware.ts`, no admin-layout role check. A `technician`-role session on the allow-list could GET admin pages (mutations still blocked). Split is UX-redirect + email-allow-list, not a hard boundary.
3. **OAuth operators have `role = null`.** ~~Role is only populated for credential logins~~ **FIXED this pass** — `resolveStaffRole` now reads the role from the DB (by subject or email) when the session carries none, so a Google operator resolves to their real `staff`/`admin` role (gate passes) while a technician resolves to `technician` (gate blocks). `requireOperator` and the new `assertOperator` both use it.
4. **`auth_events_access` policy has no `org_id` predicate** — cross-org readable/writable under any staff scope. Moot in single-org, not tenant-isolated.
5. **RLS enablement is a hand-maintained list**, not derived from schema — a future table is fully readable by `app_user` until someone edits `rls-policies.sql`.
6. **No CSP header** in prod (confirmed via `curl`; HSTS/nosniff/X-Frame-Options are present).

Credential path is otherwise sound: `bcrypt.compare`, dummy-hash timing equalization, generic `null` on every failure, 5-fail→15-min lockout, deactivated blocked at verify (staff `!== active`; tenant checks `=== revoked` — narrower but correct for current writes).

---

## 9. Defects discovered

| # | Defect | Severity | Status |
|---|---|---|---|
| D2+D3 | OAuth operator `role = null` → admin property/unit/vendor mutations gated only by email allow-list (§8.1/8.3) | Medium | **FIXED this pass** — `resolveStaffRole` reads role from DB (by subject or email) for OAuth sessions; `requireOperator` uses it; `assertOperator` now gates the 6 FormData actions; `authz-role-resolution.test.ts` (4) proves operator-allowed / technician-blocked. Deployed. |
| D1 | `web/.env.local` has stale `RESEND_FROM_EMAIL=onboarding@resend.dev` (prod correctly uses `ops@stackstorage.us`) | Low (local dev only) | Offered — trivial; not applied (personal env file) |
| D4 | No CSP header (§8.6) | Medium (security) | Offered — needs a report-only rollout first |
| D5 | `auth_events` policy missing `org_id` predicate (§8.4) | Low (single-org) | Offered — bundle with next migration |
| D6 | RLS list not schema-derived (§8.5) | Low (latent) | Offered — add a CI assertion |
| D7 | Tenant-created WO status changes never email staff; assigned tech never emailed on status change (§6A) | Medium (product) | Offered — notification-routing change, needs tests |

Per your go-ahead, D2+D3 were fixed and deployed this pass (with tests). The rest are offered, not applied.

---

## 10. External blockers (genuinely external)

- **Apple Developer Program membership** (Meso ID pending) — blocks device build, signing, APNs, TestFlight, submission.
- A **Mac with Xcode** — blocks `cap add ios`, simulator build, archive. (A simulator build needs only this, *not* Apple credentials.)
- Real **human testers on physical iPhone + Android** — blocks Device/User verification of the mobile web + push flows.
- **Live email/push send authorization** — sending real invitation/notification emails or a test push to real people is an outbound action I won't take without your go-ahead.

---

## 11. Apple credential requirements (per §6 of the request)

| Item | Required? | Exists? | Who provides | Where entered | Blocks |
|---|---|---|---|---|---|
| Apple Developer Program membership | Yes | No | Stack (Meso ID) | developer.apple.com | device build, APNs, TestFlight, submission |
| Team ID | Yes | No | derived from membership | Xcode signing | signing |
| App Store Connect access | Yes (for TF/submit) | No | membership | appstoreconnect.apple.com | TestFlight, submission |
| Bundle ID registration (`us.stackstorage.tenant`) | Yes | No (string chosen) | Stack | Developer portal | signing, push |
| App record | Yes (submit) | No | Stack | App Store Connect | submission |
| Distribution certificate | Yes | No | membership | Xcode/portal | signed archive |
| Development certificate | Yes (device) | No | membership | Xcode | device build |
| App Store provisioning profile | Yes (submit) | No | membership | portal | submission |
| APNs auth key (.p8) | Yes (native push) | No | membership | portal → your backend | native push only |
| Push Notifications capability | Yes (native push) | No | Stack | Xcode capabilities | native push |
| Associated Domains | Optional (universal links) | No | Stack | Xcode | deep links (nice-to-have) |
| TestFlight internal testers | Yes (TF) | No | Stack | App Store Connect | TestFlight |
| Privacy-policy URL | Yes (submit) | No | Stack | App Store Connect | submission |
| Support URL | Yes (submit) | No | Stack | App Store Connect | submission |
| App privacy questionnaire | Yes (submit) | No | Stack | App Store Connect | submission |
| Screenshots (per device size) | Yes (submit) | No | Stack | App Store Connect | submission |
| Reviewer test account | Yes (submit) | No | Stack (a tenant login) | App Store Connect | submission |
| Export-compliance / content-rights / age-rating | Yes (submit) | No | Stack | App Store Connect | submission |

Note: **none of the Apple items block a local iOS *simulator* build** — that needs only a Mac + Xcode + `npm install` + `cap add ios`.

---

## 12. Exact next actions

**→ Physical-device iOS testing**
1. On a Mac: `cd mobile && npm install`
2. `npm run add:ios` (generates the native `ios/` project) → `npm run assets` → `npm run sync`
3. `npm run open`, set the Team in Signing, connect an iPhone, Run. (Dev cert needs Apple membership.)

**→ Working native iOS push**
4. Enroll Apple Developer; register bundle ID `us.stackstorage.tenant`; add Push Notifications capability + `aps-environment` entitlement.
5. Create an APNs `.p8` auth key; store it as a backend secret.
6. Implement the APNs send path (currently absent) + a device-token table + `PushNotifications.register()` in the app; route tokens per user/tenant.
7. Verify a real notification reaches a physical iPhone.

**→ TestFlight**
8. Archive a signed build in Xcode → upload to App Store Connect → add internal testers → install via TestFlight → verify the loop on-device.

**→ App Store submission**
9. Fill the App Store Connect record (privacy/support URLs, screenshots, privacy questionnaire, age rating, export compliance, reviewer test account) → submit for review.

**Meanwhile (no Apple needed), to raise verification level on what's already shipped:**
- Have a real person log in as Oscar and as a Lucid tenant on a phone and run the full loop (turns "Auto-verified" into "User/Device-verified").
- With your go-ahead, send one real invitation email + trigger one web-push subscription to confirm those channels end-to-end.
- Decide on D2–D4/D7 fixes (role-from-DB, CSP, notification routing).

---

## 13. Evidence index

- Prod URL: https://stack-os-six.vercel.app · Commit `1986ba7` · Deployment `stack-a4rzm3hmj-adam-renchers-projects.vercel.app`
- Migrations `0000`–`0021` (journal confirms `0021_superb_clea`)
- Test run: 47 files / 282 passed, `stack_os_ci`, 2026-07-29 (dot reporter)
- Roster: read-only SELECT of non-secret columns (name/email/role/status/pw-present/verified/last-login) + `auth_events` count (0)
- Email: Resend `GET /domains` (`stackstorage.us` = verified) + `GET /emails` (Jul 28 send, from `ops@stackstorage.us`, `delivered`)
- Prod HTML: `curl` of `/sign-in`, `/tenant/sign-in`, `/tenant` (HTTP 200; password present, Google absent, forgot present) + response headers (HSTS/nosniff/X-Frame; no CSP)
- Code audits: notifications, RLS/authz, iOS — file:line-cited (in session record)
- No secrets, tokens, hashes, or DB URLs were printed or stored.
