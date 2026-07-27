# Lucid Rollout — Authentication & Authorization Specification

**Owner:** Security & Backend · **Update freq:** per auth change · **Decisions:** LR-001, LR-002, LR-005 · **Requirements:** AUTH-*, IDN-*, SEC-*.

This supersedes the operator Google-OAuth model for the Lucid rollout while
**reusing** the existing session, RLS (`app_user`/ADR-006), and scope-helper
plumbing. Nothing here weakens the RLS boundary.

## 1. Credential model
- **Login identifier:** email (primary) or a per-org `username`. Case-insensitive.
- **Actors with passwords (LR-002):** operators, technicians, Lucid tenants.
  External vendors keep magic-link until M9.
- **Magic-link:** retained **only** to deliver first-login/reset "set-password"
  links (not a day-to-day sign-in).
- **No account-existence disclosure (AUTH-008):** login, reset-request, and
  set-password all return a generic result regardless of whether the account
  exists.

## 2. Password hashing (AUTH-002)
- **Argon2id** (preferred) via `@node-rs/argon2`: `m=19456 KiB, t=2, p=1` (tune to
  ~50–100ms on the Vercel runtime). **bcrypt** (`cost ≥ 12`) acceptable if Argon2
  native binding is problematic on the runtime.
- Store only `password_hash` (encoded, includes salt + params). **Never** store,
  log, commit, or transmit plaintext; never place passwords in URLs/analytics/
  client bundles/fixtures.
- Verify with constant-time comparison (library-provided). Re-hash on login if
  params upgrade.

## 3. Schema changes (migration `0014_*`, additive)
`users` (operators + technicians):
- `username text` (unique per `(org_id, username)`), `password_hash text`,
  `email_verified_at timestamptz`, `failed_login_count int default 0`,
  `locked_until timestamptz`, `status text default 'invited'`
  (`invited|active|deactivated`).
- Repurpose `clerk_user_id` → nullable / rename `external_auth_id` (retains the
  Google subject during cutover). Relax the `NOT NULL` + unique constraint
  accordingly.
- Add `technician` to the role set (`staff|dispatcher|manager|admin|technician`).

`tenant_users` (already in `compliance.ts`): add `password_hash`,
`email_verified_at`, `failed_login_count`, `locked_until` (magic-link fields stay
for invite/reset).

No new RLS tables required; add a `users_system_lookup` SELECT policy (mirroring
ADR-005) if credential verification must read a user row before a session exists.

## 4. Account creation & provisioning (IDN-002, AUTH-006)
- **Invite-gated (recommended):** an admin creates the account (email + role +
  location/company scope) in `status='invited'`; the system issues a set-password
  magic link (reuse `generateToken`/`hashToken`, 7-day expiry). First visit →
  set-password form → `status='active'`, `email_verified_at=now()`.
- Operator provisioning also honors `ALLOWED_OPERATOR_EMAILS` as a defense-in-depth
  gate during cutover.
- **Deactivation:** `status='deactivated'` blocks login immediately and revokes
  active sessions on next request; audited (IDN-004).

## 5. First-login behavior
Set-password link → verify token (single-use for reset; reusable-until-expiry
allowed for first invite per existing tenant magic-link behavior) → enforce a
minimum password policy (≥10 chars, not breached-common; no composition gimmicks)
→ create hash → start session → land on the role's home surface.

## 6. Session lifecycle & cookie security (AUTH-003, AUTH-007)
- **Operators/technicians:** NextAuth v5 JWT session (existing), `AUTH_SECRET`
  signed, httpOnly + secure (prod) + sameSite. Set an explicit `maxAge`
  (recommend 7–14 days for staff; today it defaults to 30). Identity keyed on
  `users.id`.
- **Tenants:** existing signed HMAC cookie `stack_tenant_session`
  (`tenant-auth.ts`), httpOnly, secure (prod), sameSite lax, 30-day. Rename the
  shared secret from `VENDOR_MAGIC_LINK_SECRET` to a neutral `SESSION_SIGNING_SECRET`
  (keep the old env as an alias during cutover).
- **Logout:** clears the cookie/session; add operator credential signout parity
  with the existing tenant signout route.

## 7. Rate limiting & lockout (AUTH-004)
- **Per-account:** exponential backoff after 5 failed attempts; `locked_until`
  set (e.g. 15 min, doubling). Successful login resets `failed_login_count`.
- **Per-IP:** token bucket (e.g. 10 attempts/min) on `/sign-in`,
  `/tenant/sign-in`, reset-request, set-password. Backing store: Upstash Redis
  (preferred on Vercel) or a DB-backed counter for the pilot.
- Reset-request and set-password are also throttled; responses are generic.

## 8. Password reset (AUTH-005)
- **Self-serve:** user requests reset by email → generic response → if account
  exists, email a **single-use** reset token (short expiry, e.g. 1h) → set-password
  form → invalidate other sessions.
- **Admin-assisted:** admin triggers a reset link for a user (audited). No admin
  ever sees or sets a plaintext password.

## 9. Roles & authorization (SEC-001/002/003)
- Authorization is **server-side** (RLS + scope helpers + a role read); UI hiding
  is never the only control.
- Roles: `tenant` (portal), `technician` (internal field, LR-005), `operator`
  (staff; sub-roles `staff|dispatcher|manager|admin` for future RBAC granularity),
  `vendor` (external, magic-link). `admin` is the only role that manages accounts,
  buildings/companies, routing, and categories.
- **RBAC read:** guards read `users.role`. Minimum for the pilot: operator-vs-
  technician surface separation + admin-only config. Fine-grained
  dispatcher/manager/admin gating is P1.

## 10. Resource-level authorization & isolation (SEC-004)
Enforced at the DB via RLS (`rls-policies.sql`) set through `withScope` actor
context (`db.ts`). Tenant/building isolation extends to the new LOC tables
(LOC-008): tenants see only their company's suites/WOs; technicians see only
assigned work; operators see their org. **No client-supplied `org_id`/location** —
always session-derived.

## 11. Authorization matrix (role × action × resource)
`✓` allowed · `own` own-scope only · `assigned` assigned-WO only · `—` denied.

| Action / Resource | Tenant | Technician | Operator (staff→admin) | Vendor |
|---|---|---|---|---|
| Sign in (password) | ✓ | ✓ | ✓ | — (magic-link) |
| Submit work order | ✓ (own unit/suite) | — | ✓ | — |
| View work order | own (own suite) | assigned | ✓ (org) | assigned |
| View submitter identity (name+email) | own | assigned | ✓ | assigned |
| Change WO status | confirm/reopen only | assigned (ack→in_progress→resolved) | ✓ (+ close, cancel) | assigned (limited) |
| Auto/complete authoritatively | — | ✓ (resolve) | ✓ | — |
| Post **external** message | ✓ (own WO) | assigned | ✓ | assigned |
| Post **internal** note | — | assigned | ✓ | — |
| Read internal notes | — | assigned | ✓ | — |
| Upload photo | own WO | assigned | ✓ | assigned |
| View tenant/tech photos | own WO | assigned | ✓ | assigned |
| Reassign work | — | — (request coverage) | ✓ | — |
| Configure buildings/floors/suites/companies | — | — | admin only | — |
| Configure routing rules / fallback | — | — | admin only | — |
| Manage technicians / accounts | — | — | admin only | — |
| Manage vendors / COIs | — | — | admin only | own docs (M9) |
| View financial/internal data | — | — | operator (role-gated) | — |
| Manage categories | — | — | admin only | — |

RLS today already encodes the tenant/vendor SELECT scopes and system-scoped
writes (see [`GAP_ASSESSMENT.md`](./GAP_ASSESSMENT.md) §D); the matrix is the
target after SEC-002/003 add the role reads and LOC-008 extends isolation.

## 12. Migration from current auth (cutover)
1. Ship `0014` additive columns (no behavior change).
2. Land the Credentials provider behind `NEXT_PUBLIC_CREDENTIAL_AUTH=1`, **Google
   retained** as a parallel provider (dual-provider window).
3. Provision real operator/technician/tenant accounts via invite → set-password.
4. Validate login + session + RLS scoping in prod (no plaintext anywhere).
5. Flip the flag to make credentials primary; keep Google only if a stakeholder
   wants it as an operator convenience (optional).
6. Remove the demo `Credentials` stub and dead `@clerk/nextjs` (SEC-007).
   **Rollback:** flag off → Google path resumes; additive columns retained.

## 13. Audit requirements (IDN-004)
Log to `audit_log`: account created/invited/activated/deactivated, role change,
password reset (request + completion, without the token), lockout events,
permission/location-scope changes. Actor + target + timestamp; never log secrets.

## 14. Future SSO (out of scope this phase)
Google/Microsoft/SSO remain later options. The Credentials provider coexists with
OAuth providers in NextAuth, so adding SSO later is additive — do not build it now
(LR-001 revisit trigger).

## 15. Security invariants (must hold)
- No plaintext passwords anywhere (source, DB, logs, URLs, analytics, bundles,
  fixtures).
- No secrets in this repo/docs; all via Vercel env (SEC-006).
- `E2E_BYPASS_AUTH` never set in production.
- `app_user` role keeps NOLOGIN + no BYPASSRLS (ADR-006); `SET LOCAL ROLE` stays
  first statement in every txn.
- Generic auth errors; rate-limit every credential endpoint; CSP added (SEC-005).
