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

## How to add an ADR

1. Append a new section using the template above.
2. Reference the ADR number from any code comment, doc, or PR description that
   relies on the decision.
3. If a later decision supersedes this one, mark this `Superseded by ADR-NNN`
   and add the new ADR — do not edit the old one in place.
