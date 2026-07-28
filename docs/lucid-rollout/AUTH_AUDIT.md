# Stack OS — Authentication Audit & Root Cause (Phase 1)

**Owner:** Stack OS · **Status:** audit complete; implementation in progress · **Date:** 2026-07-28

Grounded trace of the production auth model before the reset. Evidence is cited
`file:line` or from read-only prod (`neondb`) queries.

---

## 1. Current authentication architecture

Two **independent** session systems, no `middleware.ts` — every route is gated
in its own page/layout (`auth()` for staff, `readTenantSession()` for tenants).

| Actor | Mechanism | Session | Gate |
|---|---|---|---|
| Operator / Admin / **Technician** | NextAuth v5 — Credentials + Google providers (`auth.ts`) | **JWT** (`session.strategy:"jwt"`, `auth.ts:94`); secure cookie (NextAuth default) | `auth()` in `(app)/layout.tsx:21`; org pinned to `STACK_ORG_ID` (`lib/server/auth.ts:33`) |
| Tenant / Resident | Email + password (`tenant-credentials.ts`) OR Google OR magic-link | **HMAC-signed cookie** `stack_tenant_session` (`tenant-auth.ts`): httpOnly, `secure` in prod, SameSite=lax, 30-day | `readTenantSession()` per page; layout renders bare when unauthed (`tenant/layout.tsx:18`) |
| Vendor | Magic-link, single-use | HMAC cookie (`vendor-auth.ts`) | `readVendorSession()` |

Credential verification (all actors): bcrypt cost 12 (`password.ts`), per-account
lockout (5/15min), **generic no-disclosure errors**, timing mitigation
(`credentials.ts`, `tenant-credentials.ts`). `CREDENTIAL_AUTH=1` is live.

---

## 2. Why Google authentication fails

- **Lucid's IT/network blocks the Google OAuth flow** (stated in the client
  meeting: "Google just didn't work … because of IP"). The redirect to Google /
  callback does not reliably complete for Lucid users on their network.
- Even when it completes, operator access additionally requires the Google email
  to be on `ALLOWED_OPERATOR_EMAILS`, and tenant Google requires a pre-existing
  `tenant_users` row for that exact email — so a first-time or slightly-mismatched
  Google identity is rejected (`tenant/sign-in` error `not_registered`).
- **Conclusion:** Google is an unreliable primary path for this client. It is
  being **disabled from the login UI**; first-party credentials become the path.

## 3. Why tenant sessions were failing / looping (the release blocker)

The symptom ("repeatedly pushed back to sign-in, no durable session") was **not a
single bug — every entry path was broken**, so all roads returned to `/tenant/sign-in`:

1. **Google** → blocked by Lucid IP (above).
2. **Magic-link** → the invite email never arrived: `RESEND_FROM_EMAIL` was
   **empty**, so every Resend send failed (`email.ts` used an empty `from`).
   *(Fixed 2026-07-28: key + `ops@stackstorage.us` on the verified domain; test send confirmed.)*
3. **Password login** → the new sign-in action hard-required `STACK_ORG_ID`,
   which is **empty on this deployment**; empty-string is falsy, so it redirected
   to `?error=config` **before ever checking the password**
   (`tenant/sign-in/_actions.ts`). *(Fixed 2026-07-28: the org is now resolved
   from the email via the `tenant_users_system_lookup` RLS policy; `STACK_ORG_ID`
   is only a hint.)*

Session persistence itself is sound: the `stack_tenant_session` cookie is
httpOnly + `secure` + SameSite=lax + 30-day, verified by HMAC over
`VENDOR_MAGIC_LINK_SECRET` — which is set at runtime (no runtime errors in 24h;
existing Google/magic-link tenants held sessions). So once a session is
*established*, mobile Safari keeps it. The loop was caused by never being able to
establish one. **Remaining Phase-2 work:** confirm this end-to-end on real mobile
Safari + the iOS container, and add explicit expiry/revocation handling.

## 4. User-model weaknesses (canonicalization)

- **Two identity tables:** `users` (staff/tech, 9 rows) and `tenant_users`
  (residents, 17 rows) in org `org_3DK8ysf4…`. A person can exist in both.
- **Duplicate identity:** `adam.rencher12@gmail.com` has **2 `users` rows** and a
  `tenant_users` row — 3 identities for one person. No unique constraint on
  `(org_id, lower(email))`.
- `role` on `users` is now read (RBAC + `technician`), but account **lifecycle**
  is thin: no `last_login_at`, no invitation-accepted signal, no self-serve reset,
  status not consistently enforced on every path.
- Names were email-prefixes for real people ("slumpkins" → fixed to "Sam").

## 5. Security risks (to close in Phases 2–4)

- No **per-IP** rate limiting (only per-account lockout) on login/reset.
- No **password-reset** flow at all → admins can't recover a locked-out user
  safely; users can't self-serve.
- No explicit **auth audit events** (login/reset/role-change/deactivate).
- Duplicate identities can cause ambiguous authz decisions.
- Google remnants on the login screen invite failed logins + confusion.

## 6. Target architecture

- **First-party credentials primary** (email/username + password); Google
  disabled from the UI (kept behind inactive config, not removed destructively).
- **Canonical identity:** one account per person per role-domain; add a partial
  unique index on `(org_id, lower(email))` for `users` **after** a
  duplicate/orphan report (no silent merges); keep `users` vs `tenant_users`
  separation (staff vs resident) but de-dupe within each.
- **Full lifecycle:** provision → invite/first-login → login → reset → change →
  deactivate/reactivate, each server-enforced + audited.
- **Rate limiting:** DB token-bucket per IP on login + reset, additive to lockout.
- **Authz:** unchanged RLS boundary (the strength of the system) + server-side
  role checks on every sensitive mutation; no client-only checks.
- **Sessions:** keep NextAuth-JWT (staff) + HMAC cookie (tenant); verify + harden
  for mobile Safari and the iOS container; add revocation + expiry UX.

## 7. Migration approach

Additive + reversible. (1) Duplicate/orphan **report** (no auto-merge). (2)
Add `last_login_at` + invitation state columns (nullable). (3) After the report
is reconciled, add the `(org_id, lower(email))` uniqueness (partial, guarded).
(4) Idempotent provisioning that never overwrites a password/role on re-run.

## 8. Tenant iOS approach

Greenfield (no Capacitor today). **Wrap the working tenant PWA in Capacitor** —
fastest safe path that preserves the shipped workflow and meets Apple review
(a real app shell around the tenant experience, not a link to a website). Native
plugins only where needed (camera/photos, secure storage for the session, push,
deep links). Everything up to **Apple enrollment/signing/submission** is built in
the repo; those final steps need the client's Apple Developer account.

---

*Phase 2+ tracked in the task list; this note is the root-cause record the reset
builds on.*
