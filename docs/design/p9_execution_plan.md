# P9 — Execution Plan

**Companion to:** [[p9_cockpit_strategy]] and all sibling P9 docs.
**Audience:** the implementer who picks this up after design sign-off.
This is the only P9 doc that names files and sequence.

---

## Current problem

The five strategy / model docs in P9 are *correct but inert* until an
implementation phase runs against them. The risk is that an
implementer starts in the middle (Stage C consequence chips, say)
without first stripping (Stage A) — and the cockpit gets *both* new
chrome and old chrome at once.

This doc names the **stages, their dependencies, and the validation
gate** so the implementation phase walks the right order.

---

## Proposed evolution

Seven sequenced stages. **A → G**. Each stage is small enough to ship
behind the existing `NEXT_PUBLIC_NEW_SHELL=1` flag in a single PR. Each
stage's verification is named; later stages should not start until
earlier stages pass.

### Stage A — Strip

**Goal:** remove surfaces and chrome. Pure deletion. No new logic.

**Scope:**

- Delete routes: `/board`, `/dispatcher`, `/work-orders`, `/dashboard`,
  `/admin/approvals`, `/help`, `/subscriptions`.
- Delete the `/settings` bridge wrapper; port destinations into
  `/admin/properties`, `/admin/vendors`, `/admin/templates` directly.
- Remove stat tiles from every surface (`/compliance`, `/money`, top
  of `/now` if any remain).
- Remove `/work-orders` property + priority filters (subsumed by /work).
- Add redirects from removed routes to their replacements for one
  release; remove redirects in the next release.

**Files touched (representative; not enumerated):**

- `web/src/app/(app)/board/page.tsx` — delete
- `web/src/app/(app)/dispatcher/page.tsx` — delete
- `web/src/app/(app)/work-orders/` — delete entire route group
- `web/src/app/(app)/dashboard/page.tsx` — delete
- `web/src/app/(app)/admin/approvals/page.tsx` — delete
- `web/src/app/(app)/help/page.tsx`, `subscriptions/page.tsx` — delete
- `web/src/app/(app)/settings/page.tsx` — delete; port content into
  `/admin/*` page wrappers
- top-bar / rail navigation: remove references to deleted routes
- `command-palette.tsx`: remove "Navigate" entries for deleted routes
- tests: drop tests against deleted routes; update smoke list in
  `scripts/p2-smoke.ts`

**Schema changes:** none.

**Verification:**

- `pnpm typecheck` clean
- `pnpm test` — all 125 tests still pass (some may be deleted with
  routes; net should be 110+ green)
- HTTP smoke: deleted routes return 308 redirect for one release
- Manual: walk through ⌘K and rail — every entry points to a live
  surface

---

### Stage B — Lane projection

**Goal:** introduce per-lane row morphology per [[lane_behavior_model]].

**Scope:**

- Add `LaneProjection` type (sum type) in
  `web/src/components/operator/lane-projection.ts` (new file).
- Refactor `web/src/components/operator/entity-row.tsx` to accept a
  `projection` prop and route field composition through a factory.
- Implement each lane's projection per
  [[lane_behavior_model]]:
  - OVERDUE: red bar, top-3 expand, pulse on oldest only
  - BLOCKED: amber bar, reason chip dominates tail, group when ≥3
    share reason
  - IN-FLIGHT: no severity bar, owner emphasized, active-duration chip
  - JUST CHANGED: single-line low-contrast strip, verb in tail
  - NEEDS YOU: indigo bar, prefix verb (`you · approve $5,400`)
  - TODAY: scheduled time on left
- Update lane headers with asides per [[lane_behavior_model]]
  ("oldest 14d · 3 block a turn").
- Add lane background tints per
  [[cockpit_information_hierarchy]] (3–5% opacity).

**Files touched:**

- `web/src/components/operator/entity-row.tsx` — extend, do not replace
- `web/src/components/operator/lane-projection.ts` — new
- `web/src/components/operator/lane-header.tsx` — extend with `aside` prop
- `web/src/app/(app)/now/page.tsx` — pass per-lane projections
- `web/src/lib/server/queue.ts` — compute lane-aside aggregates

**Reused functions (do not duplicate):**

- `loadActiveOwners()` in `web/src/lib/server/owners.ts` — feeds owner
  field
- `buildRowHints()` in `web/src/lib/server/row-hints.ts` — feeds
  subtitle hints; extend with consequence hint slot
- `overdueLane()`, `blockedLane()` etc in
  `web/src/lib/server/queue.ts` — extend with sort changes (consequence
  as secondary key on OVERDUE)

**Schema changes:** none for B. Aggregates computed at query time.

**Verification:**

- Visual: side-by-side compare /now before/after on the seeded org
- All six lanes show distinct silhouette without reading text
- Tests: existing /now render tests stay green; add 6 projection
  unit tests (one per lane)
- `pnpm typecheck` clean

---

### Stage C — Consequence chips

**Goal:** surface downstream-blocking consequence inline per
[[pressure_first_product_model]].

**Scope:**

- New loader `web/src/lib/server/consequences.ts` that computes
  per-entity consequence counts:
  - `blocks_wo_count` — WOs blocked by this WO's resolution
  - `delays_turn` — boolean; true if this WO is on critical path of
    an active unit_turn project
  - `tenant_occupied` — boolean
  - `life_safety` — boolean
- Wire into `queue.ts` per-row payload; render in `entity-row.tsx`
  tail per lane projection rules from [[lane_behavior_model]].
- Add Consequences block to the drawer's overview tab (under
  the existing memory blocks).
- Update OVERDUE + NEEDS YOU sort to use `consequence_count DESC` as
  the secondary key.

**Files touched:**

- `web/src/lib/server/consequences.ts` — new
- `web/src/lib/server/queue.ts` — extend `overdueLane`, `needsYouLane`
  with consequence join
- `web/src/components/operator/entity-row.tsx` — render consequence
  chip when projection allows
- `web/src/components/operator/entity-drawer.tsx` — add Consequences
  block under Operational

**Schema changes:** none required. Future optimization: nightly rollup
into `task_pressure_signals` table (defer until perf demands it; per
[[pressure_first_product_model]] tradeoff section).

**Verification:**

- Drawer: open any WO with consequence; block lists exact refs and
  they're clickable
- Row chips render only on top-3 OVERDUE + all NEEDS YOU (per
  lane spec)
- Performance: /now load time stays ≤ current p95
- Tests: add 4 unit tests for consequence loader (blocks_wo,
  delays_turn, tenant_occupied, life_safety)

---

### Stage D — Drawer action set

**Goal:** close the P8 DoD action gap (Assign / Snooze / Escalate) and
add keyboard bindings.

**Scope:**

- Add Assign action to drawer footer for WOs and inspections.
  - Reuses existing `assignVendor()` server function in
    `web/src/lib/server/work-orders.ts`
  - Adds vendor select (with COI-gate enforcement throwing a visible
    error if vendor COI is missing/expired)
- Add Snooze action (sets `snoozed_until` on WO; lane assignment
  respects snooze).
- Add Escalate action (sets `priority = urgent` and writes audit row;
  notifies operator's manager if configured).
- Add keyboard bindings on drawer:
  - `a` → assign menu
  - `s` → status menu (existing)
  - `c` → comment composer (existing)
  - `z` → snooze
  - `e` → escalate
  - `x` → dismiss / cancel
- Add `⌘K` entity typeahead (the other P8 DoD gap):
  - Implement search endpoint that matches refs (`WO-1043`,
    `INS-042`) and full-text titles
  - Wire into `command-palette.tsx` Search group (the placeholder
    already exists)
  - Top result opens drawer directly

**Files touched:**

- `web/src/components/operator/entity-drawer.tsx` — add AssignMenu,
  SnoozeButton, EscalateButton
- `web/src/components/operator/keyboard-provider.tsx` — extend with
  new bindings
- `web/src/components/operator/command-palette.tsx` — wire entity
  search
- `web/src/app/api/me/queue/route.ts` — extend with search query param
- `web/src/lib/server/work-orders.ts` — add `snooze`, `escalate` server
  functions
- `web/src/db/schema/work-orders.ts` — add `snoozed_until timestamptz`,
  if not already present; new migration

**Schema changes:**

- One migration: `work_orders.snoozed_until timestamptz null`. Backward
  compatible.

**Verification:**

- Drawer footer: every WO drawer shows Assign · Status → · Comment ·
  Snooze · Escalate. Inspection drawer shows applicable subset.
- ⌘K + type `WO-1043` opens the drawer.
- Keyboard: `a` opens assign menu from open drawer; `esc` closes menu.
- Tests: add integration tests for snooze + escalate state changes,
  plus a search endpoint test.

---

### Stage E — Keyboard-driven kanban batching

**Goal:** remove drag-drop, replace with keyboard batching per
[[p9_cockpit_strategy]].

**Scope:**

- Strip drag-drop handlers from `web/src/components/board/`.
- Add Shift-select to columns: clicking with Shift toggles row selection
  in the column.
- Add bottom action bar (appears when any row is selected) with
  "Status →" menu; `s` keyboard binding from same context opens it.
- Batched status transition runs as a single server action; per-card
  audit row; whole batch undoable with `⌘Z` for 30 seconds.

**Files touched:**

- `web/src/components/board/board.tsx` — remove drag-drop, add selection
- `web/src/components/operator/action-bar.tsx` — new (visible only when
  selection non-empty)
- `web/src/lib/server/work-orders.ts` — `batchSetStatus()` server function
- `web/src/lib/server/audit.ts` — `auditBatch()` helper

**Schema changes:** none.

**Verification:**

- Drag-drop is gone — try to drag a card; nothing happens.
- Select 4 cards in `triaged`, press `s`, choose `assigned` — 4
  WOs advance, 4 audit rows written, action bar dismisses.
- `⌘Z` within 30s reverts all 4. After 30s no undo.
- Tests: add 2 integration tests (batch happy path, batch with one
  invalid transition rejects whole batch).

---

### Stage F — /work as power-lens

**Goal:** turn `/work` from free-form filter catalog into saved-view
power-lens per [[p9_cockpit_strategy]].

**Scope:**

- Add `saved_views` table per org: name, filter spec, owner_user_id,
  position.
- Seed default views: `Mine`, `Overdue Mine`, `Vendor X` (per vendor),
  `Property Y` (per property), `Backlog`.
- UI: views are tabs across the top of `/work`. Click to load. `+`
  button to save a new view from current filter state.
- Backlog as a default view (was previously a toggle on `/now`).
- Remove free-form filter chips for type/status/due — these become
  view-defined.
- Keep search field (q=) — it's not a filter, it's an entity-find
  affordance.
- Keyboard: `1`–`9` selects saved view by position.

**Files touched:**

- `web/src/db/schema/saved-views.ts` — new
- `web/src/db/migrations/` — new migration
- `web/src/lib/server/saved-views.ts` — new
- `web/src/app/(app)/work/page.tsx` — rebuild around saved views
- `web/src/components/operator/saved-view-tabs.tsx` — new

**Schema changes:**

- One migration: `saved_views` table. RLS: org-scoped, owner-scoped
  for personal views.

**Verification:**

- `/work` shows tabs across top: Mine · Overdue Mine · Backlog · +
- Click a tab; filter spec applies; URL reflects view slug
- Save current filter state as a new view; reload page; new view
  appears in tabs
- `1` selects first tab; `2` second; etc.
- Backlog tab shows only zero-pressure entities

---

### Stage G — Validation gate

**Goal:** the only validation that actually matters. No code in this
stage; only walking.

**Scope:**

- Re-seed the org: `pnpm --filter web db:seed org_audit_walkthrough`.
- Walk the **morning loop** on a real phone per
  [[operator_attention_model]]. Time it; count drawer-trips; record
  friction.
- Walk the **triage loop**. Verify consequence-driven decisions
  feel right.
- Walk the **unblock loop**. Verify ⌘K typeahead lands within 3s.
- File results in `docs/stack-ops/VALIDATION.md` as a P9 entry.
- Any friction found is logged as a P10 candidate, not a P9 fix.

**Acceptance:**

- All three loops complete on phone within target times from
  [[operator_attention_model]].
- The 8am scan answers "what blew up overnight" in ≤ 90 seconds.
- The operator can describe what they see in their own words and the
  description matches the pressure model.
- 125+ tests still green.

If the walk reveals the consequence-first ranking feels wrong, revise
[[operator_attention_model]] and re-run. **The walk is the only signal
that locks the design.**

---

## Dependency order

```
A (Strip)
   ↓
B (Lane projection) ──────── must precede C, E, F
   ↓
C (Consequence chips) ───── must precede D's drawer
   ↓
D (Drawer actions + ⌘K typeahead) ── unblocks the loops
   ↓
E (Kanban batching) ── independent of D, but easier after D
   ↓
F (/work power-lens) ── independent of E
   ↓
G (Validation gate)
```

Stages B and C must precede G. Stage E and F can swap order if
contributor capacity demands it. Stage A is gating — do not start B
with deleted-route legacy still present.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Stage A deletes a route someone depended on | Add redirects for one release; monitor Inngest + smoke for hits |
| Stage B lane projection breaks mobile | Test on real phone after each lane; defer projection-X if mobile breaks |
| Stage C consequence loader expensive | Add caching only when p95 degrades; degrade gracefully if loader times out |
| Stage D snooze interacts with COI-gate | Snoozed WOs still respect COI assignment gate (RLS test required) |
| Stage E batch action partial failure | Whole batch atomicity required; if any card rejects, none move |
| Stage F saved-view sprawl | Cap at 12 views per user; surface "delete view" affordance |
| Stage G walk reveals the strategy is wrong | Acceptable — revise design docs, do not patch over symptoms |

---

## What we explicitly do not ship in P9

- AI copilot / smart triage
- Bulk import / CSV import
- AppFolio bridge (deferred per Brad, all of P9)
- New entity types beyond what exists
- Notification preferences UI (existing channels are fine)
- Reporting / analytics surfaces
- Admin role hierarchy beyond Clerk's `org:admin/member/owner`

If any of these come up during implementation as "easy wins," push them
to a P10 candidate list and stay disciplined on the seven stages.

---

## Test gates

| Stage | Min test count |
|---|---|
| A | 110+ green (after deleting tests for removed routes) |
| B | 116+ (add 6 lane projection tests) |
| C | 120+ (add 4 consequence loader tests) |
| D | 130+ (add snooze, escalate, search, ⌘K typeahead tests) |
| E | 132+ (add 2 batch action tests) |
| F | 135+ (add 3 saved-view tests) |
| G | 135+ green; field walkthrough complete |

Final P10 entry-condition: **135+ green tests + one walked phone loop
filed in `VALIDATION.md`**.

---

## Operational reasoning

### Why strip before adding

Adding to a noisy product produces an even noisier product. The
operator can't perceive the new consequence chip on `/now` if the top
of the screen still carries three stat tiles competing for attention.
Every prior P8 polish pass that landed without first stripping made
the cockpit feel busier, not clearer.

Strip first. Always.

### Why no schema-heavy stages

Stages A through E require **one** schema migration (snooze + escalate
columns). Stage F adds one table (saved_views). That's it. The P9
evolution is overwhelmingly a *render-layer + interaction* shift.
That's by design — the data model from P0–P6 is already correct for
operational thinking; what's missing is how we render it.

This matches `interaction_feel_assessment.md`'s diagnosis: the
architecture is correct; the perception layer underperforms.

### Why the validation walk is the gate

Tests verify correctness; only the walk verifies *experience*. The
P8 audit caught friction (false-positive Overdue lane) only via
walking, not via tests. The same will hold in P9. Without Stage G,
the design docs are aspirational; with it, they're verified.

---

## Companion docs

- [[p9_cockpit_strategy]] — strategic framing
- [[pressure_first_product_model]] — the model implementation must
  honor
- [[cockpit_information_hierarchy]] — what Stage B must produce
  visually
- [[lane_behavior_model]] — the concrete lane specs Stage B implements
- [[operator_attention_model]] — the loops Stage G validates
- [[card_list_hybrid_exploration]] — the rules Stage B must not
  violate
