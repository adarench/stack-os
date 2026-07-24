# Lucid Rollout — Post-Demo Product Brief

**Owner:** orchestrator · **Update freq:** at milestone boundaries · **Status:** active rollout · **Prod:** https://stack-os-six.vercel.app

## Demo outcome
We ran a successful STACK work-order demo with **Lucid**. The demo validated the
core product and clarified the concrete requirements for a production operating
loop. This is **not a redesign** — we preserve the current product, design system
("elevated operator cockpit"), sharded data model, RLS boundary (ADR-006), and the
working resident↔STACK workflow, and extend them into the full Lucid loop.

## Confirmed user groups
1. **Lucid tenant users (mobile web)** — Lucid employees (e.g. Sam, Ben, Janet).
   Individual identity, submit maintenance requests from a phone, see who
   submitted, message STACK/technician, track status, get completion summaries,
   confirm-fixed or reopen. Mobile-responsive web for the initial rollout.
2. **Internal technicians (mobile web/PWA)** — **Oscar & Fernando** (internal
   staff, **not** external vendors — LR-005). App-like field experience: only
   their assigned work, full WO detail, acknowledge/start, message the requester,
   notes, photos, status, **authoritative completion**, coverage for absence.
3. **STACK property management (desktop)** — manage all appropriate work, see the
   specific submitting user's name+email + all photos, configure buildings/floors/
   suites/companies/technicians/routing/notification recipients, assign/reassign,
   see routing reasoning, review history/notes/photos/summaries, manage vendors +
   COIs, search/filter/report — with strict role boundaries (no internal/financial
   exposure to tenants/technicians).

## Problem statement
The demo surfaced concrete blockers to a real Lucid loop: no individual
credentialed identity (operators are on Google OAuth; tenants/vendors on
magic-link; **no passwords exist**); resident requests are created **unassigned**;
**ops→tenant messages are invisible** to residents; the location model is flat
(no buildings/floors/suites/companies); and push/PWA is not launch-ready.

## Rollout objective
Deliver the **canonical operating loop** for Lucid, credential-authenticated,
proven end-to-end in production and accepted by the stakeholder.

## Canonical workflow (the acceptance target)
Lucid employee signs in on mobile (password) → submits a request with identity,
category, location, description, photo → system auto-assigns the correct building
technician (Oscar/Fernando), with a fallback → relevant people are notified →
technician opens it on mobile, messages the requester, does the work, adds notes +
photos, marks it complete (authoritatively, no redundant STACK step) → requester
gets a specific completion summary and confirms fixed or reopens → STACK sees the
full audit trail on desktop. See [`ACCEPTANCE_TESTS.md`](./ACCEPTANCE_TESTS.md)
AT-CANONICAL.

## Authentication decision
**Application-managed username/email + password for all three actor types**
(Argon2id/bcrypt, never plaintext), inside the existing NextAuth + cookie-session
plumbing. Magic-link is retained only for invite/reset. **No Google OAuth
requirement** for Lucid this phase; SSO is a later option. Full detail in
[`AUTH_SPEC.md`](./AUTH_SPEC.md); rationale in [`DECISIONS.md`](./DECISIONS.md)
(LR-001/002).

## Role definitions
- **tenant** — submits/tracks own requests; sees only own company's data + external
  messages; confirms/reopens.
- **technician** (internal, `users` + `technician` role) — sees only assigned work;
  messages requester; notes/photos/status; authoritative completion.
- **operator** (staff→admin) — manages appropriate work; **admin** manages config
  (buildings/companies/technicians/routing/categories/accounts).
- **vendor** (external, `vendor_users`) — kept distinct; magic-link; post-pilot
  parity (M9).
Authorization is server-side (RLS + scope helpers + role reads), not UI-only.

## Product principles
- Preserve the working product + design system; extend, don't rebuild.
- Server-side authorization + RLS is the security boundary — never UI-only.
- Individual identity, never a shared login.
- Internal notes are strictly separated from participant-visible messages.
- Technician completion is authoritative.
- Structured/deterministic first; AI is optional, labeled, grounded, never required.
- Reliability before breadth; email before push (but push is a launch gate).

## Scope (this rollout)
Credential auth + identity + RBAC; the two confirmed defect fixes; commercial
location/company model + configurable routing; technician mobile workflow;
completion lifecycle + structured summary; email notifications; **push +
installable PWA (launch gate)**; pilot hardening + acceptance.

## Non-goals (this rollout)
- Native iOS/Android app or App Store submission (LR-010; M10 is evaluation only).
- SSO / Google / Microsoft enterprise auth (later option).
- AppFolio import / accounting (out of scope, per existing product stance).
- AI-generated summaries as a required path (optional later, SUM-003).
- External vendor portal as a pilot blocker (M9, post-pilot).
- SMS as a pilot channel (Twilio A2P pending; email + push are the channels).

## Success measures
- AT-CANONICAL passes on production with real Lucid accounts (pilot DoD).
- Zero open P0 launch blockers in [`STATUS.md`](./STATUS.md).
- Every post-demo requirement is `Accepted` (acceptance test + sign-off), not just
  `Deployed`.
- No cross-tenant/company data leakage; no plaintext credentials; internal notes
  never reach tenants.
- Push validated on real iPhone + Android.

## Major risks
Auth cutover (highest — mitigated by additive schema + dual-provider flag);
commercial-hierarchy backfill correctness; routing-config completeness; iOS
Safari push/PWA quirks; email deliverability; first-real-user friction. Full
risk/rollback per milestone in [`ROADMAP.md`](./ROADMAP.md).

## Outstanding client inputs
Users/roles, buildings/floors/suites/companies, routing + fallback, categories,
notification recipients, Resend domain, VAPID keys + test devices, pilot cohort —
tracked in [`CLIENT_INPUTS.md`](./CLIENT_INPUTS.md) with a copy/paste request for
Lucid.

## Web now, native later
The initial rollout is **mobile web / PWA** for tenants and technicians. Native
App Store distribution is explicitly deferred pending field validation; it will be
re-evaluated (M10) only after the web/PWA loop is accepted, and only with separate
approval.
