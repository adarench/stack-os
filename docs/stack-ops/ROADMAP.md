# Stack OS — Roadmap

**Owner:** human (orchestrator) · **Update freq:** weekly + at every phase boundary

## Current phase

**P1/P2 hardening** (in progress) — making the work-order board and list
genuinely usable as a Trello/AppFolio replacement before expanding scope.

P0 closed. P1 + P2 code landed. Hardening pass added: search, dispatcher
list view, mobile photo upload (multi-file + progress + retry + 25 MB cap),
route groups so `pnpm build` is green without creds, 41 unit tests
(was 18). Pending validation: real Neon/Clerk/R2/Resend creds and Day-3
end-to-end on a phone. P3 not started — explicitly deferred per Brad.

## Status legend

`▢ pending`  ·  `▣ in progress`  ·  `▦ blocked`  ·  `■ done`

## Phase table

| Phase | Days | Status | What | Definition of done |
|---|---|---|---|---|
| P0 | 0–2 | ■ | Docs + scaffold + Clerk + Drizzle + RLS + Inngest wiring + Twilio A2P filed + AppFolio probe | Preview deploy live; Clerk login works; RLS smoke test passes; A2P submitted; AppFolio probe done or filed in OPEN_QUESTIONS |
| P1 | 3–7 | ▣ | work_orders CRUD, properties/units, vendors, comments/attachments, mobile shell, photo capture, vendor magic-link invite | Real WO created on phone, photo uploaded, comment added, vendor assigned via magic link, SMS or email delivered |
| P2 | 8–12 | ▣→■ | Trello kanban + list views, drag-drop, dispatcher view | Dispatcher drags card from "new"→"assigned" on desktop; same view usable on phone |
| P3 | 13–18 | ▣ | Recurring tasks (`task_templates` → spawned `work_orders`), scheduling, calendar, notifications dispatch | Template spawns daily WO via Inngest cron; notifications respect prefs |
| P4 | 19–28 | ▣ | Inspections + findings → spawn WO, unit turns (project + child WOs), projects | Inspector logs finding on phone → auto-WO created; unit-turn dashboard groups WOs by stage |
| P5 | 29–35 | ▣ | Vendor COI tracking + tenant insurance + expiry alerts + vendor self-serve portal | Vendor uploads COI; expired-COI vendors blocked from new WO; tenant insurance expiry triggers email |
| P6 | 36–42 | ▣ | Light financial states (estimate → approved → invoiced → paid), approvals, costs, time entries | WO has cost estimate → approval flow → invoice attached → marked paid; threshold rules work |
| P7 | 43+ | ▣ | Operating dashboard, exec view, reporting (AppFolio import deferred per Brad) | Exec dashboard shows open WOs, COI gaps, MTD cost; CSV export works |

Days are agent-speed elapsed, with 1–2 humans driving 3–4 agents. Calendar weeks
are usually longer due to non-code blockers (Twilio A2P, AppFolio creds, vendor
adoption).

---

## P4–P7 detailed plans

Concrete deliverables for the remaining phases, based on what we learned
shipping P0–P3. Each phase carries forward the patterns that worked
(sharded entities, app_user RLS role, system-actor cross-org policies for
trusted server flows, Inngest for async work, magic-link identities for
external participants).

### P4 — Inspections + unit turns + projects

**Why:** today's WO model doesn't capture "an inspection produced these
12 findings, now spawn 12 WOs and group them under a unit-turn project."
This is the biggest gap between Stack OS and AppFolio for Brad's day-to-day
ops.

**Schema (4 new entity tables; reuses comments/attachments/audit polymorphism):**
- `inspections` — `kind` (move_in/move_out/annual/ad_hoc), `scheduled_for`,
  `started_at`/`completed_at`/`reviewed_at`, `inspector_user_id`,
  `property_id`, `unit_id` (state machine already in
  `/contracts/state-machines/inspection.ts`)
- `inspection_findings` — `inspection_id`, `severity` (info/observation/
  actionable/critical), `area` (kitchen/bath/exterior/...), `description`,
  `spawned_work_order_id` (nullable, set when actionable)
- `projects` — `kind` (unit_turn/capex/renovation/make_ready/general),
  `status` (state machine in `/contracts/state-machines/project.ts`),
  `budget_cents`, `target_completion`, `gc_user_id`,
  `parent_project_id` (nullable, for sub-projects later)
- `work_orders.project_id` — new FK column; existing WOs migrate as null

**Server lib:**
- `/lib/server/inspections.ts` — `createInspection`, `updateFinding`,
  `completeInspection` (atomically converts actionable findings to WOs in
  one transaction and links them via `spawned_work_order_id`)
- `/lib/server/projects.ts` — CRUD + status transitions, list child WOs
- `assignVendor` extended to set the assignment's `assigned_via` field
  (manual / template_spawn / inspection_spawn / project_spawn)

**Inngest:**
- `inspection.completed` event → fan-out: notify property manager,
  spawn child WOs (idempotent on `(inspection_id, finding_id)`)

**UI:**
- `/inspections` list — kind filter, status filter
- `/inspections/[id]` mobile-first: each finding gets a row with
  pass/fail toggle, severity, photo capture (reuses `<PhotoCapture>`),
  notes. Submit-to-review button at bottom.
- `/projects` list + detail with kanban-of-WOs grouped by stage
- `/work-orders/[id]` shows parent project link if set
- `/admin/properties/[id]/turns` — list of historical unit turns

**Risks (from earlier stress-test, still load-bearing):**
- **Multi-WO atomicity** when an inspection produces N findings — needs a
  single transaction or compensating undo. Solve via withScope wrapping
  the spawn loop.
- **Unit-turn complexity** — the original stress-test flagged this as
  "a week of work alone." Bound it: P4 ships the data model + linking +
  the kanban-of-WOs view. Move-out → move-in workflow automation comes
  in P4.5 if needed.
- **Performance** on inspections with 30+ findings + photos. Mitigation:
  paginate findings, lazy-load attachments.

**Dependencies:** P1 (work_orders), P3 (Inngest for spawn-on-completion).

**DoD:** inspector logs an inspection on a phone, marks 5 findings (3
actionable), submits → 3 WOs are created and visible on `/work-orders`,
all 3 are linked back to the inspection on its detail page, and a
`unit_turn` project linking all of them is created from the move-out
inspection.

**Estimated days:** 8–10. The schema is straightforward; the UX
(inspection-on-phone, finding rows with photos, atomic spawn) is the
work.

---

### P5 — Vendor COI + tenant insurance compliance

**Why:** legal-team-flagged compliance work. Vendors with expired COIs
shouldn't be able to take new assignments; tenants need to upload renewal
certificates and PMs need visibility into what's expiring.

**Schema (new entity tables):**
- `vendor_cois` — `vendor_id`, `policy_number`, `carrier`,
  `coverage_amount_cents`, `effective_at`, `expires_at`,
  `attachment_id` (FK to `attachments`), `status`
  (active/expiring/expired/superseded)
- `tenants` — minimal already exists; expand to include `clerk_user_id`
  (nullable, if tenant has staff-side access — most won't) and
  `phone`/`email` for invites
- `tenant_users` — magic-link identity, mirrors `vendor_users` pattern
- `tenant_insurance_policies` — `lease_id`, `policy_number`, `carrier`,
  `coverage_amount_cents`, `effective_at`, `expires_at`,
  `attachment_id`, `status`
- `leases` — minimal already exists; expand if needed for insurance
  tracking

**Server lib:**
- `/lib/server/coi.ts` — `recordCoi`, `listExpiringCois(daysAhead)`,
  `vendorCanReceiveAssignments(vendorId)` (gate)
- `/lib/server/tenant-insurance.ts` — same shape, lease-keyed
- `assignVendor` adds a check: if no active COI, throw
  `vendor_coi_expired_or_missing`. Override flag for emergency
  assignments (audit-logged).

**Vendor portal extension:**
- New tab on `/vendor` for "Documents". Upload COI via the existing
  signed-URL upload flow. Auto-extract effective/expiry if possible
  (defer OCR; just have vendor type the dates).

**Tenant portal (NEW surface):**
- `/tenant/auth/[token]` magic-link route mirroring vendor's
- `/tenant` dashboard: lease, insurance status, upload renewal
- `tenant_users` table + cookie session (mirrors `vendor_users`)
- New RLS policies: `tenant_users_self`, `tenant_users_system_lookup`,
  `tenant_insurance_policies_self`

**Inngest:**
- Daily cron `coi-expiry-sweep`: finds COIs with `expires_at < now() +
  30d`, transitions status to `expiring`, emits notifications
- Same for tenant insurance
- On expiry: status → `expired`, vendor blocked from new assignments
  (UI badge), notification to PM

**UI:**
- `/admin/compliance/cois` — table view: vendor / status / expires /
  upload action
- `/admin/compliance/tenants` — table view: tenant / lease / insurance
  status / expires
- Badge on vendor cards in `/admin/vendors` and `/dispatcher` showing
  COI status

**Risks:**
- **Tenant portal is a whole new identity surface.** Magic-link via
  Resend mirrors vendor; should be straightforward but doubles the
  external-auth surface area.
- **Compliance enforcement timing** — Q-010 in `OPEN_QUESTIONS.md`
  is "should expired tenant insurance ever block lease actions?"
  Default to advisory (warn + log); blocking actions need ops/legal
  approval per-org.
- **Document formats** — PDFs, images, sometimes Word docs. Existing
  attachments table handles this; OCR for auto-extracting expiry
  dates is out of scope for P5 (manual entry).

**Dependencies:** P1 (vendor_users + storage), P3 (Inngest cron).

**DoD:** vendor uploads a COI via the vendor portal on their phone →
COI row created, attachment linked, status `active` → 30 days before
expiry, daily sweep fires `coi_expiring` notification → on expiry,
attempting to assign that vendor throws `vendor_coi_expired_or_missing`
in the UI, with an audit-logged override option for emergencies.

**Estimated days:** 7–9.

---

### P6 — Light financial states

**Why:** WOs need cost tracking, vendors need to submit estimates and
invoices, dispatchers need to approve over thresholds. Critically, this
is **not** a GL — accounting stays in AppFolio.

**Schema:**
- `task_costs` — `work_order_id`, `kind` (labor/materials/fee/other),
  `description`, `amount_cents`, `entered_by_user_id`,
  `entered_by_actor_type`
- `task_time_entries` — `work_order_id`, `started_at`, `ended_at`,
  `vendor_user_id`, `hourly_rate_cents`, `hours_decimal`
- `invoices` — `vendor_id`, `work_order_id` (nullable for batch invoices),
  `invoice_number`, `total_cents`, `status` (draft/submitted/approved/
  paid/disputed/void), `attachment_id` (PDF/image), `paid_at`
- `approvals` — already exists from P0, just needs:
  - `threshold_amount_cents` rule per org (defaults: <$500 auto, $500–$5K
    needs manager, >$5K needs owner)
  - UI to surface pending

**Server lib:**
- `/lib/server/costs.ts` — `addCost`, `addTimeEntry`, `totalForWorkOrder`
- `/lib/server/invoices.ts` — `submitInvoice` (vendor-side),
  `approveInvoice` (creates approval row if over threshold; auto-approves
  otherwise), `markPaid`
- Threshold lookup: per-org config row, default if absent

**Vendor portal extension:**
- "Submit estimate" form on assigned WO — adds `task_costs` rows
- "Submit invoice" form — uploads PDF/photo, creates `invoices` row in
  `submitted` status

**UI:**
- WO detail: "Costs" section with line items, total, status pill
  (estimate / approved / invoiced / paid)
- `/admin/approvals` queue: pending approvals sorted by amount/age
- `/admin/financials` summary: outstanding invoices, approved-not-paid,
  this-month spend per property

**Risks:**
- **Scope creep into a GL.** Hard rule: amounts are tracked, not
  reconciled. No double-entry. No tax handling. No payments
  (just a `paid_at` timestamp).
- **Approval threshold UX** — bypassing for owners while requiring
  approvals for managers. Use Clerk org roles (`org:owner`, `org:admin`,
  `org:member`).

**Dependencies:** P1 (work_orders + vendor_users), P5 (vendor portal).

**DoD:** vendor submits a $750 estimate via the vendor portal → an
approval row is created (threshold exceeded) → manager approves in
`/admin/approvals` → vendor submits a $720 invoice → manager marks paid
→ `task_costs` rolls up correctly on the WO and on the property
financial summary.

**Estimated days:** 7–10.

---

### P7 — Operating dashboard + AppFolio import + reporting

**Why:** the team needs an exec view ("how are we doing this week?")
and we need to bridge to AppFolio so Stack OS isn't a parallel universe
of property data.

**Operating dashboard:**
- `/dashboard` — exec view, mobile-friendly
  - Open WOs by status (counts + spark line over 7d)
  - Overdue WOs (past due_at)
  - COI gaps (count by status: expiring, expired)
  - Tenant insurance gaps
  - MTD cost (from `task_costs`) with previous-period comparison
  - Vendor leaderboard (WOs completed, avg time-to-resolve)
  - Property-level rollups
- Recharts (or similar) for the visuals
- Cached aggregates via Inngest hourly job
  (`/lib/server/dashboard-rollups.ts` writes summary rows)

**AppFolio import:**
- `/scripts/appfolio-sync.ts` — Inngest scheduled job (nightly)
- `appfolio_sync_runs` table — tracks each run, drift counts, errors
- ETL: properties + units + vendors + leases + tenants
- **Read-only.** Stack OS is the source of truth for WOs, inspections,
  templates, COIs, comments, attachments. AppFolio is the source of
  truth for property/unit/lease structure.
- External_id columns already exist on properties/units/vendors for
  this; just wire them up
- Reconciliation report: rows in AppFolio not in Stack OS (auto-import),
  rows in Stack OS not in AppFolio (flag for human review)

**Reporting:**
- CSV export per WO list / dispatcher / cost report
- Scheduled email report ("daily ops summary") via Inngest

**Risks (from P0 stress-test, still relevant):**
- **AppFolio API quality** — rate-limited, undocumented edges, dirty data.
  The plan agent flagged this as "a multi-week effort in disguise." We
  budget 2 weeks for the import alone; if the API is worse than expected,
  fall back to scheduled CSV imports.
- **Drift handling** — what happens when AppFolio renames a property,
  deletes a unit, etc. Strategy: soft-delete (status=archived) on
  Stack OS side; never hard-delete entities that have referenced WOs.
- **Aggregation cost** — dashboard queries can get expensive at scale.
  Mitigation: hourly cached rollups; raw query is the slow path.

**Dependencies:** all prior phases. AppFolio API credentials (Q-007 in
`OPEN_QUESTIONS.md`).

**DoD:** open `/dashboard` on a phone → see real numbers. Run the
nightly AppFolio sync → properties/units/vendors imported with
external_id links. Reconciliation report flags any drift.

**Estimated days:** 10–14 (2 weeks for AppFolio import alone).

---

### Cumulative timeline

| Phase | Start day | End day | Notes |
|---|---|---|---|
| P0 | 0 | 2 | ✅ done |
| P1 | 3 | 7 | ✅ functional; awaits human Day-3 |
| P2 | 8 | 12 | ✅ automation-validated 63/63; awaits human acceptance |
| P3 | 13 | 18 | ▣ first push live; needs Inngest prod keys |
| P4 | 19 | 28 | inspections + unit turns + projects |
| P5 | 29 | 37 | COI + tenant insurance + tenant portal |
| P6 | 38 | 47 | costs + invoices + approvals |
| P7 | 48 | 60+ | dashboard + AppFolio sync + reporting |

Total agent-speed estimate: ~60 days for full feature set. Calendar time
will be longer (Twilio A2P unblocks at week 2-4, AppFolio import is
dirty work, vendor adoption requires real users).

### Sequencing notes

- **P4 → P5 dependency**: P5's vendor portal extension depends on P4's
  inspection finding flow (vendors are often the ones who close out
  finding-spawned WOs).
- **P5 → P6 dependency**: vendor invoice submission (P6) reuses the
  vendor-portal upload flow built in P5.
- **P3's Inngest cron infrastructure** is reused by P5 (COI sweep) and
  P7 (dashboard rollups + AppFolio sync). Nothing additional needed.
- **P7's dashboard** is the only phase where rendering speed becomes a
  real concern — query optimization or materialized views are P7
  decisions, not P4–P6 ones.

### Common patterns to keep using

- Sharded entity tables, NOT a kind-discriminated `tasks` table (ADR-002)
- `app_user` role + `SET LOCAL ROLE` in every transaction (ADR-006)
- Polymorphic `comments` / `attachments` / `audit_log` / `approvals` /
  `assignments` for any new task-like entity
- Magic-link identities for external participants (vendors P1, tenants P5)
- Inngest for async + scheduled work; emit events from server actions
- Notifications go through `emitNotification` with prefs respected
- Server functions throw on invalid state; redirect on auth failure
- Tests: integration with mocked Clerk auth + RLS smoke per new entity

## Next focus

After P0 sign-off:
1. Lock the P1 task brief for each lane (Backend, UI, Infra).
2. Spin up Frontend & Mobile UI Agent and Infra & DX Agent in parallel with
   Schema & Backend Agent.
3. File Twilio A2P 10DLC (long pole).

## Blocked

See [`OPEN_QUESTIONS.md`](./OPEN_QUESTIONS.md).

## Rollback strategy

Every phase ships behind a feature flag (`wo_v1`, `board_v1`,
`recurring_v1`, ...). Disable to roll back. Schema migrations are reversible OR
shipped behind a flag with a dual-read period. File uploads are not deleted on
rollback.
