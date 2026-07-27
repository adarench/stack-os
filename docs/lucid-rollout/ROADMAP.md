# Lucid Rollout — Implementation Roadmap

**Owner:** human (orchestrator) · **Update freq:** weekly + at every milestone boundary · **IDs:** see [`REQUIREMENTS_TRACKER.md`](./REQUIREMENTS_TRACKER.md).

Milestones are sequenced by dependency, adjusted for the four confirmed decisions
(credentials for all 3 actors, full commercial hierarchy, auth-first slice, **push
is a launch gate**). **No calendar dates are invented** — `Owner` and `Target` are
`TBD` until assigned. `Size` is relative (S/M/L). Every requirement has exactly one
**primary** milestone; a requirement is `Accepted` only via its acceptance test +
stakeholder sign-off (separate from `Deployed`).

Legend: 🚦 = launch gate for the Lucid pilot.

---

## M0 — Baseline & decisions 🚦(hygiene)
**Objective:** stand up the control system + engineering hygiene so every later
milestone is trackable and safely deployable.
**Requirements:** OBS-001/002/003/005, SEC-006/007, ADM (docs), LIF-001.
**Dependencies:** none.
**Workstreams:** create these 12 docs; GitHub Actions CI (typecheck + lint +
`lint:tokens` + unit + DB-gated integration + RLS + e2e); Sentry (or equiv) +
structured logging; migration step in the deploy pipeline; remove dead
`@clerk/nextjs` + demo `Credentials` stub from prod builds; **quarantine
prod-writing scripts** (`invite-demo-tenants.ts`, `cancel-*-wos.ts`,
`restore-fallback-wo.ts`) behind an explicit env guard + move out of default path.
**Data/config:** none (no schema).
**Migration:** none.
**Tests:** CI must run green on a PR; RLS tests execute against a CI Neon branch.
**Acceptance:** CI blocks merges on red; error tracking receives a test event;
docs reviewed.
**Deploy/rollback:** CI/observability are additive; rollback = disable workflow.
**Risks:** CI Neon branch cost/secrets. **Size:** M. **Owner/Target:** TBD.
**DoD:** PRs gated by CI; observability live; no prod-writing script runs on a
normal deploy; docs merged.

---

## M1 — Credential auth + individual identity + RBAC 🚦 *(first implementation slice)*
**Objective:** operators, technicians, and Lucid tenants each log in with an
individual username/email + password; identity is attached to submissions; RBAC +
`technician` role exist server-side.
**Requirements:** AUTH-001..008, IDN-001..004, SEC-001/002/003/005.
**Dependencies:** M0 (CI to gate the security-sensitive change).
**Workstreams:** add Argon2id + rate-limit dep; migration `0014` (credential
columns + `technician` role); replace demo `Credentials` stub with a DB-backed
verifier (`auth.ts`); credential forms on `/sign-in` + `/tenant/sign-in`;
invite→set-password + reset (self + admin); RBAC read of `users.role`; CSP header;
show submitter name+email in ops + (later) tech surfaces.
**Data/config:** operator/tech/tenant accounts provisioned by invite (real Lucid
users, secrets via env/password-manager — never committed).
**Migration:** additive columns; relax `clerk_user_id`; dual-provider window
behind `NEXT_PUBLIC_CREDENTIAL_AUTH=1`.
**Tests:** unit (hash/verify, throttle/lockout, generic error, `authorize()`);
integration (provision→login→session, wrong-password non-disclosure,
deactivated-user blocked, RBAC op-vs-tech, **RLS still isolates**); e2e (operator +
tenant credential login on mobile viewport).
**Acceptance (AUTH_SPEC §DoD):** an operator, a technician, and a Lucid tenant log
in with individual passwords on mobile; wrong creds → generic error + lockout;
RBAC separates operator vs technician; no plaintext anywhere.
**Deploy:** flag-gated cutover; Google retained during window.
**Rollback:** flag off (Google resumes); additive columns retained.
**Risks:** lockout UX, Argon2 native binding on Vercel runtime, cutover confusion.
**Size:** L. **Owner/Target:** TBD.
**DoD:** all M1 tests green; AUTH-*/IDN-*/SEC-001/002/003 → Ready for QA;
credentials primary in prod for the pilot cohort.

---

## M2 — Confirmed-defect cluster: messaging + tenant auto-assign + photo reliability 🚦
**Objective:** close the two demo-blocking defects and harden photos.
**Requirements:** MSG-001/003/004/005/007/008/009/010, ASN-001 (minimal), ATT-001..009,
TEN-005/006/007/010, ADM-004 (commercial categories).
**Dependencies:** M1 (identity for correct attribution) — but the defect fixes are
independent and can start in parallel.
**Workstreams:** "Reply to requester" affordance defaulting to `external` on
tenant WOs (MSG-001); stamp `tenantUpdatedAt` on tenant messages (MSG-010);
tenant auto-assign inserts an `assignments` row when a covering tech exists
(ASN-001 minimal); MIME allowlist + unified size cap + **HEIC handling** (ATT-006/007);
verify tenant↔STACK↔tech photo visibility (ATT-001/002/004); add commercial
categories (Cleaning, Supplies, Soap/restroom, Beverage) to `work-order-category.ts`.
**Data/config:** category list confirmed with Lucid.
**Migration:** none (categories are nullable text).
**Tests:** MSG boundary tests (operator reply visible to tenant; internal note
not); tenant-submit → assignment + owner + "mine"; HEIC round-trip; size/MIME
rejection; photo role-access.
**Acceptance:** a tenant and STACK exchange visible messages; a tenant photo is
seen by STACK and the assigned tech; a resident WO shows an owner.
**Deploy:** standard; **Rollback:** revert per-fix (small, independent).
**Risks:** HEIC transcoding on the runtime. **Size:** M. **Owner/Target:** TBD.
**DoD:** MSG-001, ASN-001, MSG-010 fixed + tested; photo pipeline validated.

---

## M3 — Commercial location/org model + configurable routing + technician accounts 🚦
**Objective:** model Lucid's buildings/floors/suites/companies; route work by
building with a fallback; real technician accounts.
**Requirements:** LOC-001..008, ASN-002..008, ADM-001/002/003, TEC-001/010/011,
SEC-004, TEN-003.
**Dependencies:** M1 (technician role), M2 (assignment insert path).
**Workstreams:** new tables `buildings/floors/suites/tenant_companies` + membership;
migration + backfill from `properties/units` (dual-read); RLS policies for the new
tables (preserve ADR-006); admin config UI; building→tech ownership + org fallback
+ absence/escalation; assignment-reasoning surfaced; real Oscar/Fernando accounts;
tenant/WO context reads new model.
**Data/config:** Lucid buildings/floors/suites/companies/routing/fallback (see
[`CLIENT_INPUTS.md`](./CLIENT_INPUTS.md)).
**Migration:** additive tables + backfill; dual-read window; reversible.
**Tests:** migration/backfill test; RLS isolation on new tables; routing (building
rule, fallback, absence); tenant context shows correct building/suite/company.
**Acceptance:** a Lucid tenant's request shows accurate building/floor/suite/company
and auto-routes to the correct technician (or fallback), never silently unassigned.
**Deploy:** migration + backfill first, then feature flag for new context UI.
**Rollback:** dual-read → fall back to flat model; keep new tables.
**Risks:** backfill correctness; routing config completeness. **Size:** L.
**Owner/Target:** TBD.
**DoD:** LOC-* + ASN-* → Ready for QA; routing demoable on Lucid data.

---

## M4 — Technician mobile workflow 🚦
**Objective:** Oscar/Fernando run the full field loop on a phone.
**Requirements:** TEC-002..013, ATT-002/003, MSG-002, ADM-007.
**Dependencies:** M1 (accounts/RBAC), M2 (photos/messaging), M3 (assignment/context).
**Workstreams:** technician PWA — assigned-work queue (only their work), WO detail
(requester, building/floor/suite/company, category, scope, photos, access info),
acknowledge/start, technician messaging (external to requester + internal notes),
notes, phone photo capture/upload, status updates, **authoritative completion**,
reassignment/coverage requests, overdue/priority/schedule.
**Data/config:** technician device list for validation.
**Migration:** none (reuses existing tables).
**Tests:** tech e2e (open assigned WO → message requester → add note+photo →
in_progress → resolved); role-boundary (tech sees only assigned; no
internal/financial exposure).
**Acceptance:** a technician completes a job end-to-end on a phone; completion is
authoritative (no operator step).
**Deploy:** role-gated surface. **Rollback:** hide tech surface (data intact).
**Risks:** field UX on real devices. **Size:** L. **Owner/Target:** TBD.
**DoD:** TEC-* → Ready for QA; validated on Oscar/Fernando's phones.

---

## M5 — Completion lifecycle + structured completion summary 🚦
**Objective:** a reliable, structured completion record; correct confirm/reopen.
**Requirements:** SUM-001/002, LIF-002/003/005/006/007/008, TEN-008, ATT-010.
**Dependencies:** M4 (technician completion).
**Workstreams:** assemble structured summary at `resolve` (title, requester,
building/floor/suite, tech, category, original issue, work performed, notes,
completion photos, date/time, final status, confirmation); tenant-visible summary;
route all status writes through the shared guard (LIF-002); duplicate-completion
guard (LIF-003); null `completedAt` on reopen (LIF-005); populate `blockedReason`
(LIF-007); reconcile client transition table (LIF-008).
**Migration:** small (summary storage or derived view).
**Tests:** summary content/assertion; reopen clears completion; duplicate-complete
no-op; blockedReason labels fire.
**Acceptance:** on completion the requester receives a specific, correct summary and
can confirm or reopen; reopened WOs are consistent.
**Deploy:** standard. **Rollback:** feature-flag summary surface.
**Risks:** summary completeness across edge cases. **Size:** M. **Owner/Target:** TBD.
**DoD:** SUM-* + LIF-* → Ready for QA.

---

## M6 — Email notifications 🚦
**Objective:** dependable, non-duplicating, useful email for every relevant event.
**Requirements:** EML-001..012, MSG-006.
**Dependencies:** M2 (messaging), M5 (completion summary for EML-005).
**Workstreams:** fix staff-path email (EML-004); align Inngest event contract with
the 9 kinds; branded template; authenticated deep links; idempotency key
(EML-009); honor preferences; verify Resend key + **verified sending domain** in
prod (EML-012); delivery-log surface.
**Data/config:** Resend domain verified; notification-recipient config from Lucid.
**Tests:** per-event email emitted; retry → single send; no cross-tenant leak;
deep link enforces scope.
**Acceptance:** each canonical-loop step sends the right email to the right person
with a working authenticated link, no duplicates.
**Deploy:** standard. **Rollback:** disable non-critical events.
**Risks:** deliverability/domain reputation. **Size:** M. **Owner/Target:** TBD.
**DoD:** EML-* → Ready for QA; real inbox round-trip verified.

---

## M7 — Push notifications + installable PWA 🚦 **(LAUNCH BLOCKER — LR-008)**
**Objective:** validated web push + an installable PWA on the actual devices.
**Requirements:** PUSH-001..006, PWA-001..005, EML-011 (prefs).
**Dependencies:** M6 (event taxonomy), M1 (persistent sessions).
**Workstreams:** add branded manifest icons/assets (PWA-001); real service worker +
**global registration** (not opt-in-only); web push for supported devices;
foreground/background/closed/expired/revoked handling; notification preferences UI;
set VAPID keys in prod; **validate on real iPhone + Android**.
**Data/config:** VAPID keys; test devices.
**Tests:** subscription lifecycle; push matrix; Lighthouse installable; real-device
checklist.
**Acceptance:** installable on iOS + Android; push received in all four states on
real devices.
**Deploy:** standard. **Rollback:** push behind a flag; PWA icons are additive.
**Risks:** iOS Safari push limitations/PWA quirks. **Size:** M. **Owner/Target:** TBD.
**DoD:** PUSH-* + PWA-* → Ready for QA; **launch-gate checklist signed on real
devices.**

---

## M8 — Production pilot hardening + acceptance 🚦
**Objective:** prove the whole loop in production and get stakeholder sign-off.
**Requirements:** OBS-004/006/007, SEC-004 (final), ADM-006, all P0 → Accepted.
**Dependencies:** M1–M7.
**Workstreams:** dependency-checked health endpoint; refreshed production smoke of
the canonical loop; security + authorization review; RLS review incl. LOC tables;
real-device validation; backups + rollback runbook; pilot cohort onboarding;
run the [`ACCEPTANCE_TESTS.md`](./ACCEPTANCE_TESTS.md) canonical E2E on prod.
**Tests:** the canonical end-to-end acceptance test passes on production with real
accounts; smoke green.
**Acceptance:** stakeholder signs off the canonical loop; P0 requirements move to
**Accepted** with acceptance owner + date.
**Deploy/rollback:** documented; feature flags for staged cohort.
**Risks:** first real-user friction. **Size:** M. **Owner/Target:** TBD.
**DoD:** canonical loop `Accepted`; no open P0 launch blockers in
[`STATUS.md`](./STATUS.md).

---

## M9 — External vendor workflow (post-pilot)
**Objective:** external vendors run the same loop with proper isolation.
**Requirements:** VEN-001..007, COI-001/002/003, SUM-003 (optional).
**Dependencies:** M4/M5 (internal workflow accepted). **Launch gate:** no.
**Workstreams:** vendor assignment acceptance, details/messaging/status/photos/
completion parity; vendor notification emails; COI access from the vendor area;
keep vendor identity/role distinct from internal techs (LR-005).
**Size:** L. **Owner/Target:** TBD. **DoD:** VEN-* → Ready for QA.

---

## M10 — Native / TestFlight / App Store evaluation (deferred)
**Objective:** decide whether native distribution is warranted after field
validation. **No build** unless separately approved (LR-010).
**Dependencies:** M7/M8 field validation. **Size:** S (evaluation). **DoD:** a
written recommendation, not code.

---

## Dependency order (critical path to pilot)
`M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8`. M6/M7 can overlap M4/M5 partially;
M2's two defect fixes can run in parallel with M1. **Push (M7) gates launch**, so
it must complete before M8 acceptance. M9/M10 are post-pilot.

## Rollback strategy (portfolio-wide)
Ship behind flags (`NEXT_PUBLIC_CREDENTIAL_AUTH`, per-surface flags); additive,
reversible migrations with dual-read windows; **never delete uploaded files or
demo/production records on rollback** (audit history preserved).
