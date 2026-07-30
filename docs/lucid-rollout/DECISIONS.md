# Lucid Rollout — Decision Log

**Owner:** human (orchestrator) · **Update freq:** per decision · **Scope:** the Lucid production rollout of STACK OS.

These `LR-NNN` decisions govern the Lucid rollout. They are additive to the
existing `docs/stack-ops/DECISIONS.md` ADR-001…ADR-006 and **supersede or amend**
some of them where noted. Format: ID · Date · Status · Context · Decision ·
Rationale · Consequences · Revisit trigger.

Status: `Proposed | Accepted | Superseded`. Confirmed with stakeholder on
**2026-07-23** unless noted.

---

## LR-001 — Initial authentication is username/email + password
**Date:** 2026-07-23 · **Status:** Accepted · **Supersedes:** ADR-001 (Clerk-for-staff) and the current NextAuth-Google operator model for the rollout.

**Context.** Prior planning referenced Google OAuth; the running app authenticates
operators via **NextAuth v5 + Google** (`web/src/auth.ts`) and tenants/vendors via
magic-link. There is no password support anywhere.

**Decision.** Operators, technicians, and Lucid tenants sign in with an individual
**username/email + password**, hashed with **Argon2id** (bcrypt acceptable),
managed inside the existing NextAuth framework (Credentials provider) + the
existing tenant/vendor cookie-session plumbing.

**Rationale.** Lucid needs individual, self-provisioned identities without an
enterprise IdP dependency for the first rollout. Passwords fit the existing
session/RLS plumbing with the smallest correct change.

**Consequences.** New `password_hash`/credential columns; a real Credentials
verifier replacing the demo stub; rate-limiting + reset flows; remove dead
`@clerk/nextjs`. Never store plaintext; never commit credentials.

**Revisit trigger.** Lucid mandates SSO/Google/Microsoft, or multi-org scale
arrives.

---

## LR-002 — Credentials for all three actor types; magic-link becomes invite/reset only
**Date:** 2026-07-23 · **Status:** Accepted · **Amends:** ADR-003 (vendor magic-link identity).

**Decision.** Operators, technicians, **and** Lucid tenants each get a
password credential. Magic-link is retained **only** for first-login invites and
password resets — not as a primary day-to-day sign-in. External vendors keep
magic-link for now (their password migration is M9).

**Rationale.** "Individual identity rather than a shared generic tenant login" is
a stated Lucid requirement; passwords give a durable per-person credential.

**Consequences.** Tenant portal gains a credential login route; magic-link
issuance is repurposed to deliver set-password links.

**Revisit trigger.** Tenants find password management too heavy → reconsider
passwordless for tenants only.

---

## LR-003 — Tenant experience is mobile web
**Date:** 2026-07-23 · **Status:** Accepted.
**Decision.** The Lucid tenant experience is a mobile-responsive web app (existing
`/tenant`), not a native app for the initial rollout.
**Revisit trigger.** Field validation shows web is insufficient for tenants.

---

## LR-004 — Technician experience is mobile web / PWA
**Date:** 2026-07-23 · **Status:** Accepted · **Amended by LR-014** (that mobile
experience is the responsive console, not a separate portal).
**Decision.** Oscar/Fernando get a polished mobile-first responsive/PWA
experience. Native App Store distribution is deferred (LR-010).
**Revisit trigger.** Push/offline needs exceed PWA capability on their devices.

---

## LR-005 — Oscar/Fernando are internal technicians (`users` + `technician` role), NOT vendors
**Date:** 2026-07-23 · **Status:** Accepted · **Amends:** ADR-003 scope ·
**Amended by LR-014** (the role drives routing/notifications, not console access).

**Context.** `vendor_users` is the external, multi-PM, magic-link identity.
Oscar/Fernando are internal staff; the seed already models them as `users`.

**Decision.** Internal technicians are `users` with a new `technician` role,
assigned via `assignments.assigneeType = "user"`. `vendor_users` stays reserved
for **external** vendors only. Do not conflate the two into one role model to
reuse screens.

**Rationale.** Their RLS scope, notification routing, and data visibility differ
from external vendors; conflation would leak privilege or under-scope them.

**Consequences.** Add `technician` to the role set; RBAC reads `users.role`;
technician mobile surfaces are scoped by *assignment*, not by role (LR-014 removed
the role gate — a tech sees the same console as any operator).

**Revisit trigger.** A future need to give internal techs multi-org identity.

---

## LR-006 — Technician completion (`in_progress → resolved`) is authoritative
**Date:** 2026-07-23 · **Status:** Accepted (documents existing behavior).
**Decision.** A technician marking a job complete (`in_progress → resolved`,
stamping `completedAt`) is the single authoritative completion action. No
redundant operator "complete" step. The tenant then confirms (`→ verified`) or
reopens (`→ in_progress`); ops closes (`verified → closed`).
**Rationale.** Already true in code (`work-orders.ts:256`); make it a guaranteed
invariant with server-side duplicate-completion prevention.
**Revisit trigger.** A business need for operator sign-off before completion.

---

## LR-007 — Tenant-messaging defect is a launch blocker
**Date:** 2026-07-23 · **Status:** Accepted.
**Decision.** The confirmed defect where ops replies default to `internal` and are
invisible to residents (see MSG-001) is a P0 launch blocker, fixed in M2.
**Revisit trigger.** None — must fix.

---

## LR-008 — Email precedes push in build order, but push is a launch gate
**Date:** 2026-07-23 · **Status:** Accepted (stakeholder-designated).
**Decision.** Reliable in-app + email notifications are built first (M6), but
**web push + installable PWA (M7) is a launch gate** for the Lucid pilot — the
pilot does not go live until push is validated on real iOS/Android.
**Rationale.** Stakeholder designated push a launch requirement.
**Revisit trigger.** Stakeholder relaxes push to post-pilot.

---

## LR-009 — External vendor portal follows the internal technician workflow
**Date:** 2026-07-23 · **Status:** Accepted.
**Decision.** The external vendor work loop (M9) is built after the internal
technician workflow is accepted. Vendors stay a distinct identity/role (LR-005).
**Revisit trigger.** A vendor becomes a pilot blocker.

---

## LR-010 — Native / TestFlight / App Store work is deferred
**Date:** 2026-07-23 · **Status:** Accepted.
**Decision.** No native iOS/Android app or store submission until the web/PWA loop
is field-validated and separately approved (M10 is an evaluation only).
**Revisit trigger.** Field validation demands native capabilities.

---

## LR-011 — Full commercial location model (buildings / floors / suites / tenant companies)
**Date:** 2026-07-23 · **Status:** Accepted.

**Context.** The current model is a flat `property → unit → resident`
(`properties.ts`, `units.ts`); Lucid is commercial (buildings, floors, suites,
tenant companies).

**Decision.** Introduce **first-class** `buildings`, `floors`, `suites`, and
`tenant_companies` (+ membership) tables (LOC-*), with a reversible migration and
backfill from the existing property/unit rows. Location + company are derived
from the tenant's session, never client input.

**Rationale.** The flat model cannot express Lucid's structure or accurate routing
/ context; a proper hierarchy is the correct long-term shape.

**Consequences.** New migration + RLS policies; admin config UI; tenant/WO context
reads the new model. Larger workstream (M3).

**Revisit trigger.** A simpler portfolio makes the hierarchy overkill (unlikely
for commercial).

**Implementation note (M3).** Realized **additively** rather than as an all-new
table hierarchy + backfill (which would rewire `work_orders`/`units` app-wide and
is high-risk): `properties` = **building**, `units` = **suite** (now carrying
`floor`/`suite` columns), plus a first-class **`tenant_companies`** table
(`tenant_users.company_id`) and an **`org_settings`** table for the org-level
**fallback assignee** (ASN-003/008). Migration `0015` is additive (no backfill).
This delivers the commercial location + company + routing capability now; a fully
separate `buildings/floors/suites` table hierarchy remains a later refinement if a
multi-building-per-property need appears.

---

## LR-012 — Completion summary is structured/deterministic first
**Date:** 2026-07-23 · **Status:** Accepted.
**Decision.** The completion summary (SUM-001) is a deterministic structured
record assembled from work-order history. AI-assisted prose is an **optional,
clearly-labeled, history-grounded, never-required** later enhancement (SUM-003).
**Rationale.** Reliability first; the summary must be verifiable and cannot depend
on model output to complete the workflow.
**Revisit trigger.** Structured summary proves insufficient for readability.

---

## LR-013 — M0 engineering-hygiene approach (CI, observability, migrations, scripts)
**Date:** 2026-07-23 · **Status:** Accepted.

**Context.** M0 establishes merge/deploy gates. Some infra needs secrets/accounts
not present in-repo (a CI database; an error-tracking DSN). We must not invent
secret values, add brittle checks, or introduce destructive automation.

**Decision.**
1. **CI** (`.github/workflows/ci.yml`): every push/PR runs install(frozen) →
   typecheck → lint → `lint:tokens` → unit tests → production build. DB-backed
   **integration + RLS** run in a **separate job that is visibly SKIPPED** (grey,
   not a green pass) unless the repo **variable** `CI_DB_ENABLED=true` **and**
   **secret** `CI_DATABASE_URL` (a **disposable** Neon branch) are set. The job
   fails fast if enabled without the secret, **never falls back** to a prod/dev DB,
   and never prints the connection string. The split keeps the DB state honest and
   is required because the app runtime uses the Neon serverless (WebSocket) driver
   — a plain Postgres container cannot serve the app-function tests. Playwright
   **e2e is excluded** (browsers/bypass-auth/server/DB); run locally.
2. **Observability**: baseline is a dependency-free **structured logger** +
   Next.js **`onRequestError`** (captured by Vercel logs). An error-tracking
   **vendor (Sentry) is deferred** to a documented manual integration at that
   exact seam — no DSN is invented.
3. **Migrations are NOT auto-applied from the Vercel build** (destructive risk on
   every preview/prod build). They run via explicit guarded `db:migrate`, and in
   the CI integration job against the CI branch. **Auto-apply-on-deploy is an open
   decision** (build-time vs a gated release step).
4. **Scripts:** the one read-only diagnostic (`audit-workorders.ts`) was
   generalized (explicit `--org`, no prod default, env-validated) and **committed**;
   five disposable/client-specific one-offs stay **git-ignored** (their
   `STACK_ALLOW_PROD_WRITES` guard is **local-only**, not committed protection).
   Committed protection = `_prod-guard.ts` + the CI committed-env guard +
   `.gitignore` quarantine.

**Rationale.** Smallest production-safe gate without brittleness, without inventing
secrets, and without destructive automation.

**Consequences.** Until `CI_DATABASE_URL` is configured, RLS/integration are not
enforced in CI (a known, tracked gap). Sentry needs a manual follow-up.
Migration-on-deploy needs a decision before M-later automation.

**Revisit trigger.** A CI Neon branch is provisioned; a Sentry account exists; or
we decide the migration-automation strategy.

**Implementation note (2026-07-27).** With stakeholder authorization to use the
production connection, the CI database was implemented as an **isolated database
`stack_os_ci` on the production Neon endpoint** (not a separate Neon branch).
Postgres connections are database-scoped, so the CI suite cannot read/write the
production `neondb` data — production data is untouched while reusing the authorized
endpoint. `CI_DB_ENABLED=true` + `CI_DATABASE_URL`/`CI_DATABASE_URL_UNPOOLED` are set;
the DB integration/RLS job **runs and passes on PR #2** (30 files / 212 tests).
Branch-protection enforcement remains pending (GitHub plan-gated on this private repo).
A dedicated Neon branch remains the cleaner long-term target (separate compute,
resettable) — revisit if CI load on the prod compute or `stack_os_ci` drift becomes an issue.

---

## LR-014 — Technicians get the full console; the separate tech portal is not their home
**Date:** 2026-07-30 · **Status:** Accepted · **Amends:** LR-004, LR-005 (consequences only).

**Context.** Oscar and Fernando were sent to `/tech` — a one-job, chrome-less
field view — while Jen (admin) got the whole console. In a three-person
maintenance operation that reads as a demotion, not a design: the techs couldn't
see the org-wide queue, the calendar, buildings, or reports, and the client
raised it directly ("he's mad he can't see all the same stuff").

**Decision.**
1. **`technician` is a job, not a reduced access tier.** Every internal staff
   role gets the same console. New gate: `hasConsoleAccess` (all of
   `ALL_STAFF_ROLES`), used by `/` routing and the admin server actions.
2. **No forced portal.** `/` lands every staff member on `/my` — already the
   "what's on me" lens a tech lives in. The `(tech)` routes stay live as the
   mobile one-job view that SMS/push/email deep links (`/tech/WO-123`) open, and
   now carry a "Full console →" link out. They are a deep-link target, not a home.
3. **`OPERATOR_ROLES` keeps its old membership** (staff/dispatcher/manager/admin,
   techs excluded) but is now *only* the team-wide notification fan-out list
   (`notifyOpsTeam`) — never an access check. Preserves the client's routing rule
   ("email all of us, except the tech whose job it is") unchanged.
4. **No role data change.** Oscar/Fernando stay `technician` in the DB, so
   property coverage, auto-routing, the assignable-tech picker, and SMS dispatch
   (all of which key off the role) keep working exactly as before.

**Rationale.** The console was never role-gated at the data layer — RLS scopes by
org, not role — so the restriction was two lines (a redirect + an action gate)
buying nothing operationally. Half-parity is worse than either extreme: leaving
Admin nav visible while its buttons error out reproduces the same complaint.

**Consequences.** Technicians can run the admin server actions (add a person,
reset a password, deactivate an account, edit buildings/units). That is a real
privilege widening, accepted for a small internal team where everyone is trusted
staff; every action still writes an audit/auth event with the actor. A separate
"tech updates" tab remains an open idea, not a commitment.

**Revisit trigger.** The team grows past trusted-internal size, an external or
seasonal tech needs an account, or account/password management needs to be
admin-only — at which point split `hasConsoleAccess` (view) from an
`isAdminRole`-backed account-management gate rather than reinstating the portal.

---

## Existing ADR reconciliation

| Existing ADR | Status under Lucid rollout |
|---|---|
| ADR-001 (Clerk staff auth) | **Superseded by LR-001** — operator auth is NextAuth+password, not Clerk; remove dead `@clerk/nextjs`. |
| ADR-002 (sharded entity tables) | **Unchanged** — keep. LOC-* tables follow the same pattern. |
| ADR-003 (vendor magic-link identity) | **Amended by LR-002/LR-005** — magic-link → invite/reset; internal techs are `users`, not vendors. |
| ADR-004 (`org_id` is text) | **Unchanged**. |
| ADR-005 (`*_system_lookup` cross-org policies) | **Unchanged** — reused for credential lookup. |
| ADR-006 (`app_user` role, no BYPASSRLS) | **Unchanged — load-bearing.** All new tables/policies must preserve it. |
