# Stack OS — Decisions (ADR-lite)

**Owner:** human · **Update freq:** per architectural decision

Each ADR is numbered and dated. Status: `Proposed` | `Accepted` | `Superseded`.
Format: # / Date / Context / Decision / Alternatives / Why.

---

## ADR-001 — Stack: Next.js 15 + Postgres + Drizzle + Clerk

**Date:** 2026-05-05 · **Status:** Accepted

**Context.** Greenfield internal Maintenance + Compliance OS for a real estate
operator. Initial scale: <100 properties / <500 units / <20 staff+vendors.
Mobile-first PWA. The team will run multiple Claude agents in parallel and
needs an "agent-friendly" stack — strong types, conventional patterns, low
operational footprint.

**Decision.** Next.js 15 (App Router, RSC, server actions) on Vercel, Neon
serverless Postgres, Drizzle ORM, Clerk for staff auth (orgs/roles), Cloudflare
R2 for storage, Inngest for background jobs, Resend (email) and Twilio (SMS),
shadcn/ui + Tailwind v4.

**Alternatives considered.**
- *Convex + Next.js + Clerk* — faster initial scaffold and real-time by
  default, but vendor lock-in and weaker SQL ergonomics for reporting.
- *Supabase end-to-end* — single vendor, good RLS story, but more friction for
  Clerk-style orgs/roles than Clerk.

**Why.** Boring, well-known, agent-friendly. Drizzle types + RSC + server
actions reduce bespoke code. Postgres + RLS gives a defensible tenant boundary.
Easy to migrate later if needed. Confirmed by user before scaffold.

---

## ADR-002 — Sharded entity tables; reject unified `tasks` table

**Date:** 2026-05-05 · **Status:** Accepted

**Context.** Maintenance ops have many "task-like" things: work orders,
inspections, unit turns, projects, recurring templates. The temptation is to
make them all rows in one `tasks` table with a `kind` discriminator.

**Decision.** Use sharded entity tables (`work_orders`, `inspections`,
`projects`, `task_templates`) sharing polymorphic subsystems for `comments`,
`attachments`, `checklists`, `audit_log`, `approvals`, `assignments`,
`task_scopes`.

**Alternatives considered.**
- *Unified `tasks` table with `kind` enum* — elegant on paper. Falls apart
  under state-machine pressure (one machine can't model 5 different kinds),
  RLS pressure (kind-aware policies multiply), and UI pressure (every screen
  branches on `kind`). Recurring templates in particular have no status, no
  assignee, no due date — stuffing them in `tasks` requires `WHERE kind !=
  'template'` everywhere.
- *Fully separate subsystems (separate comments per entity)* — duplicates a
  lot of code and audit infrastructure for no gain.

**Why.** Three tables with shared polymorphic subsystems is the same
engineering effort as one table with kind branches, and ages better. Recurring
templates are a generator spec, not a task instance — they belong in
`task_templates`. Projects are containers with budgets, not tasks. Inspections
produce findings that spawn work orders — they're not the same shape.

---

## ADR-003 — Vendor identity is separate from Clerk orgs

**Date:** 2026-05-05 · **Status:** Accepted

**Context.** Vendors will use the system in the field on phones. They often
work for multiple property-management companies. Putting vendors in the staff
Clerk org is wrong (privilege bleed). Putting each vendor in their own Clerk
org is expensive and breaks for multi-PM vendors.

**Decision.** A separate `vendor_users` table. Magic-link auth via Resend.
A single human vendor can have multiple `vendor_users` rows — one per
(org, vendor, email). RLS policies for vendor scope are narrow: read assigned
work_orders, read/post `external` comments on those work orders, read/upload
attachments on those work orders.

**Alternatives considered.**
- *Clerk org per vendor* — costly; doesn't model multi-PM vendors.
- *Vendors as Clerk users in the staff org with limited role* — privilege
  bleed; staff data leaks via shared org id.

**Why.** Vendors are external, multi-tenant identities. They need a
purpose-built scope. Magic-link is friction-free for field use; SMS magic-link
is added in P5 alongside the vendor portal.

---

## ADR-004 — `org_id` is text (Clerk org id), not uuid

**Date:** 2026-05-05 · **Status:** Accepted

**Context.** Clerk organization IDs are strings like `org_2abc...`, not UUIDs.
The original P0 schema had `org_id uuid` on every entity table.

**Decision.** Change `org_id` columns to `text`. The RLS helper
`current_org_id()` returns text. `app.org_id` session var holds the Clerk
org id directly, no mapping table.

**Alternatives considered.** Maintain a separate `orgs` table mapping Clerk
ids → internal UUIDs. Adds a join on every query; no benefit since Clerk's
ids are already globally unique and stable.

**Why.** Simpler. No mapping layer. Correct from day one. Done before any
migration ran, so no data migration was needed.

---

## ADR-005 — `system` actor type can read `vendor_users` cross-org

**Date:** 2026-05-05 · **Status:** Accepted

**Context.** The vendor magic-link verify flow needs to look up a token hash
without yet knowing which org owns it. The standard staff org-scope policy
requires `org_id = current_org_id()`, blocking cross-org reads.

**Decision.** Add a narrow `vendor_users_system_lookup` SELECT policy that
allows any row when `current_actor_type() = 'system'`. App code sets
`actor_type='system'` only in trusted server paths
(`/lib/server/vendor-invite.ts`).

**Alternatives considered.**
- *BYPASSRLS database role* for trusted code — proper hardening, but adds
  ops complexity (separate role, separate connection string). Defer to a
  later phase.
- *Public token-lookup table* keyed only on token hash — duplicates state
  and adds a second source of truth.

**Why.** Single policy, narrow scope, trusted-server boundary documented
in code. Move to BYPASSRLS in a later phase if this becomes load-bearing.

---

## ADR-006 — App connects via `app_user` role (no BYPASSRLS)

**Date:** 2026-05-05 · **Status:** Accepted

**Context.** Neon's default owner role (`neondb_owner` and equivalents on
other Postgres providers) has the `BYPASSRLS` attribute. Even with `ENABLE
ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`, a connection as the
owner role silently bypasses every policy. Without this fix, our tenant
isolation would have been effectively off in production. Caught when the
real RLS integration tests started running against Neon and showed every
cross-org SELECT returning rows.

**Decision.** `db/rls-policies.sql` creates an `app_user` role with
`NOLOGIN` and no `BYPASSRLS`, grants it CRUD + sequence + execute
privileges, and grants `app_user` membership to the connecting role so
`SET ROLE` is allowed. `withScope` in `web/src/lib/server/db.ts` and the
RLS test harness both do `SET LOCAL ROLE app_user` as the FIRST statement
in every transaction, before setting `app.org_id` / `app.actor_type` /
`app.vendor_user_id`.

`ALTER DEFAULT PRIVILEGES` ensures future tables created under the owner
role auto-grant to `app_user` — no manual re-grant after each migration.

The owner role keeps its privileges (and `BYPASSRLS`) so migrations,
RLS policy applications, and admin scripts can still run unfiltered.

**Alternatives considered.**
- *Connect directly as `app_user`* — would require a separate connection
  string with a different password, and SET ROLE inside the transaction
  is simpler than maintaining two connection strings.
- *Strip `BYPASSRLS` from the owner role* — Neon manages the owner role;
  altering it is brittle and breaks Neon's own tooling.
- *Trust `FORCE ROW LEVEL SECURITY` alone* — `FORCE` enforces RLS for
  table owners but does NOT override `BYPASSRLS`; that attribute always
  wins.

**Why.** This is a defense-in-depth correction: app code can now never
silently bypass tenant isolation, even if a future regression skips
`SET LOCAL ROLE`. (If `SET LOCAL ROLE` is missing, the connecting role
still has `BYPASSRLS` — but the four RLS integration tests would catch
this in CI before it ships.)

---

## How to add an ADR

1. Append a new section using the template above.
2. Reference the ADR number from any code comment, doc, or PR description that
   relies on the decision.
3. If a later decision supersedes this one, mark this `Superseded by ADR-NNN`
   and add the new ADR — do not edit the old one in place.
