# Tier 3 Strategy — Operational Cognition Spreads

**Frame.** Tier 1 built the operator shell. Tier 2 Phase A taught the
*drawer* to think. Tier 3 teaches the rest of the product to think —
without redesigning a single surface, adding a single page, or
shipping a single chart.

**The thesis in one line:** memory + causality + graph already exist
in the drawer. The next leap is **pushing them up into the rows and
across the surfaces**, so an operator senses pressure, history, and
consequence without opening anything.

This document is a thinking pass. It walks the diagnostic, names the
leverage points, sequences the build, and draws the line on what to
skip.

---

## 0. What landed in Tier 2 Phase A (anchor)

Before the critique, what's already on the surface:

- `lib/server/memory.ts` — three loaders: unit history (recurrence
  + previous resolved), vendor reliability (gated on
  `MIN_SAMPLE=5`), sibling work (open WOs at same property).
- Drawer renders three compact monospace sections: `UNIT HISTORY`,
  `VENDOR · <name>`, `ALSO HERE · <property>`. All gated — they
  render only when there's real signal. Never a chart.

The screenshot pair to anchor this audit: `test/screenshots/tier2-A/`
— particularly `10-drawer-memory-vendor.png` and
`11-drawer-memory-unit.png`. They show the discipline working.

---

## 1. Ruthless audit — where cognition actually lives

The honest grid of how much each surface *knows*:

| Surface | Memory | Causality | Graph awareness |
|---|---|---|---|
| /now (lanes) | none | weak (lane tails encode immediate state, not cause) | none |
| /work (flat list) | **none** | **none** | none |
| /compliance | none | strong (CANNOT DISPATCH + "blocks N WOs") | none |
| /money sign-offs | none | medium (WO consequence chip in card) | none |
| /money vendor billing | none | weak (vendor grouping only) | none |
| /inbox | none | none (chronological only) | none |
| drawer (WO) | **strong** (Phase A) | strong (WAITING ON SIGN-OFF + ALSO HERE) | weak |
| drawer (AP) | none | strong (WILL UNBLOCK) | none |

**The pattern:** cognition exists exactly where we built it
explicitly. Most of the product still operates row-by-row, surface-by-
surface, transactionally.

**The diagnosis:** the next leap isn't "another cognitive surface" —
it's *propagating* the cognition that lives in the drawer back out
into the queue and across the surfaces. Operators currently must
*open the drawer* to discover what the system knows. That's wrong.
They should *feel* it on the row.

---

## 2. The diagnostic frame

Three cognitive layers × three depths of penetration:

```
                  drawer-level     row-level     surface-level
                  ──────────────────────────────────────────────
  memory          ✓ (Phase A)       ✗              ✗
  causality       ✓ (waiting/will)  weak           ✗
  graph           weak               ✗              ✗
```

The product reads as "the drawer is intelligent; everything else is
a database query." That's the gap.

The Tier 3 work is **filling the empty cells** — in priority order
of operator leverage, not in priority order of difficulty.

---

## 3. Priority 1 — /work stops being a list

**This is the single biggest remaining weakness in the product.** The
user has flagged it three sprints in a row. The Tier 1 deferral on
urgency banding still bites. /work is the surface operators spend the
most flat time on, and it still reads as a 42-row spreadsheet.

### Critique of the current state

Looking at `test/screenshots/tier2-A/02-work.png`:
- 42 rows, all 32px (with opacity-70 on low-priority).
- Severity rails on urgent/blocked rows — visible but quiet.
- Filter chip bar inline with count. Compact, correct.
- No section headers, no urgency grouping, no above-the-fold focus.

The eye scans the page in O(N) — every row gets equal attention. A
dispatcher landing on /work must read text to triage.

### Proposed evolution

**Urgency banding** — inline section headers (not card containers)
that partition the SAME flat list:

```
OVERDUE 8  · oldest 5d
[8 overdue rows]

BLOCKED 4
[4 blocked rows]

IN-FLIGHT 6
[6 active rows]

SCHEDULED TODAY 2
[2 today rows]

ACTIVE 18
[18 active rows]

▸ BACKLOG 38     (click to expand)
[collapsed by default]
```

**Constraints:**
- Single-line headers at `text-[11px] uppercase tracking-wider`.
- Same row composition as today — no card containers, no
  re-layout.
- Backlog collapses by default (huge cognitive win — most
  operators never need to scroll past it).
- Sort within bands: priority DESC → updated_at DESC.

**+ "Mine" toggle** in the upper-left:

```
[ All · Mine · Unassigned ]
```

A single chip. Filters all bands. URL-state-driven. No
configuration surface.

### Why this is mandatory now

- It's the single most-trafficked surface that hasn't gotten
  cognitive treatment.
- The data + sort already exist server-side — this is pure
  rendering.
- It's ~2 engineering days for a structurally different felt
  experience.
- Every Tier 3 piece below benefits from /work having structure
  (e.g., row-level memory hints land harder when the row is
  already in a pressure band).

---

## 4. Priority 2 — Row-level memory hints (cognition propagates)

The drawer knows "this unit has had 3 plumbing issues in 60d." The
*row* in the queue should hint at that fact before the operator
opens the drawer.

### The cognition-spread move

Add an **optional subtitle line** to rows that have a high-signal
memory or causality fact:

```
[bar] ●  WO-1001  URG  Bathroom ceiling leak — 247 Maple · 2A
                                                   Stark · -5d
                       3rd plumbing 60d · vendor: 2 stressed
```

The subtitle is 9-10px monospace, muted, max 2 hints. Routine rows
have **no subtitle** and stay at 32px. Signal rows grow to ~44px.
This creates a natural pressure-driven density variation — high-
signal rows visually loom larger.

### Where memory hints come from

The same `loadUnitHistory` / `loadVendorReliability` /
`loadSiblingWork` helpers from Phase A. They run per-row in the
queue loader. Costs ~1 SQL query each — manageable at 25 rows per
lane.

### Hint shortlist (curated, not exhaustive)

- `Nth plumbing 60d` — when unitHistory.topTradeHint matches AND
  count ≥ 2
- `vendor: N stressed` — when assigned vendor has activeStressed > 0
- `Mth at property` — when ALSO HERE count ≥ 3
- `cold Xd` — when row is open + no movement for ≥ 14d (more
  aggressive "stale" signal)
- `blocks dispatch` — when this WO is itself the gate for other
  work (computed downstream)
- `from INS-XXXXX` — when WO was spawned from an inspection with
  open findings

### Discipline

- **Max 2 hints per row.** If three apply, pick the loudest two.
- **Never show a hint that's obvious from the row already.** Don't
  say "overdue 5d" — the time chip already says that.
- **Hide hints on the most routine rows** — a low-priority annual
  smoke detector test doesn't need a subtitle, even if data exists.
- **Cap subtitle rows at ~30%** of total rows on a typical page.
  Above that and the page reads cluttered.

---

## 5. Priority 3 — Causality across surfaces

The drawer's WAITING ON SIGN-OFF and WILL UNBLOCK are the model.
Tier 3 propagates this kind of cross-entity awareness to the queue.

### /now overdue lane — downstream-blocked tail

Currently the overdue tail reads `Stark Plumbing Co · -5d`. When a
WO is blocking something operationally important (a scheduled
inspection, a tenant move event, another WO), the tail picks up the
downstream:

```
WO-1001  URG  Bathroom ceiling leak — 247 Maple · 2A
              Stark · -5d · blocks INS-A4BC Fri
```

The new fragment is `blocks INS-A4BC Fri` — clickable into the
inspection drawer. Subtle. Only renders when the downstream is non-
obvious.

### /money approval card — vendor reliability inline

The approval card already shows the underlying WO consequence
("WO BLOCKED · OVERDUE 2D"). Add a quiet vendor reliability hint:

```
estimate awaiting sign-off  WO-1001  pending 6h  $1450
  Bathroom ceiling leak — 247 Maple · 2A  OVERDUE 5D
  Stark Plumbing submitted estimate over your $1000 threshold.
  Vendor: 92% on-time over 8 jobs (30d) · 5 active
  [Approve] [Reject]                  holding SP
```

One added line of monospace gray. The approver decides faster
because the vendor context is right there.

### /compliance violations — expand into entity refs

Currently `BLOCKS 2 WOS` is a chip with a count. Make it inline-
expandable: clicking the chip toggles a list of the actual WO refs
underneath:

```
Bright Appliance Repair  BLOCKS 2 WOS ▸     no insurance on file
  WO-1034  Stove burner replacement — Maple 1B
  WO-1023  Replace dryer vent screen — Elm 2B
```

The chip already exists; just becomes a disclosure. Operators
clicking it see the actual at-risk work in two seconds.

### /inbox — operational weight per kind

Notifications get rendered weight per `kind`:

- **High (bolder, slight indent):** `wo_blocked`, `wo_overdue`,
  `vendor_declined`, `approval_decided` (rejected), `coi_expired`,
  `tenant_insurance_expired`
- **Standard:** `wo_assigned`, `approval_requested`, `comment_*`
- **Quiet (opacity 70):** `template_spawned`,
  `tenant_insurance_received`, `coi_received`, system events

The inbox stops being a chronological feed and starts being a
priority-aware coordination surface.

---

## 6. Priority 4 — Drawer continues to deepen

The drawer is the strongest surface in the product. Don't slow down.

### Phase A added

- `UNIT HISTORY`
- `VENDOR · <name>`
- `ALSO HERE · <property>`

### Phase B should add

#### Tenant context (when unit has a tenant)

```
TENANT · Marcus Webb (5 tickets all time · last 7d ago)
```

Short. No avatar. Just the operator's mental model of the human
on the other side of the call.

#### Inspection lineage (when WO was spawned from an inspection)

```
FROM INS-A4BC  annual inspection · 3 findings · 2 still open
```

Clickable into the inspection drawer. Operators see "this is part
of a bigger walk-through" in one line.

#### Approval pattern (on /money sign-off drawer)

For an approval drawer, a small `APPROVAL HISTORY` block:

```
APPROVAL HISTORY
  4th budget exception in 30d
  Stark has 3 other approvals pending
```

Patterns the operator would otherwise have to compute mentally.

#### Compact dispatch timeline (status change history)

A horizontal dot-strip showing the entity's status journey:

```
new → triaged → assigned → blocked
  -3d   -2d      -1d        -2h
```

Not a chart. Just dots + verbs. The operator sees the *shape* of
this WO's life at a glance.

### Drawer discipline (unchanged)

- No charts.
- No badges or scorecards.
- Each section ≤2 prose lines.
- Hide entire sections when there's no signal (don't show empty
  "TENANT" when the unit has no tenant).
- Max ~6 visible sections in the WO drawer — beyond that the
  cockpit becomes noise.

---

## 7. Priority 5 — Cross-entity hover-highlight (the moat)

The single most distinguishing interaction Stack OS can ship. No
generic PM tool has this. It is the visual proof that the system
*knows* its data, not just stores it.

### The interaction

Operator hovers any entity ref on screen (`WO-1001` in the activity
strip, `AP-CD8C73` in the WAITING ON SIGN-OFF list, the assigned
vendor name in the OVERDUE lane):

1. The hovered element turns from gray to foreground.
2. Other on-screen surfacings of the **same entity** subtly
   highlight (5% bg color shift).
3. **Related** entities — known via the operational graph — also
   highlight, at a fainter 3% shift.

No animation. No motion. Instant on hover, instant on hover-out.

### Implementation sketch

- Server attaches `data-ref="WO-1001"` and (where known)
  `data-related="AP-CD8C73,INS-A4BC"` to row/card root elements.
- Client-side, on layout mount, build a `Map<ref, HTMLElement[]>`
  + a `Map<ref, ref[]>` (the graph edges).
- `onMouseEnter` of a `[data-ref]` element: look up the ref, find
  all matching elements, apply CSS class. Look up related refs,
  apply faint class. `onMouseLeave`: remove.
- No re-render. No state. Just DOM class toggles. ~50 lines of TS.

### Calibration is everything

The single biggest risk is making it too loud. 5% bg shift on a
white surface is "the operator notices a quiet flicker." That's
the right intensity. We'll need to iterate after first render.

### When this lands

Phase D in the original Tier 2 plan. Sequence-wise: ship row-level
memory + causality first (so there's more relational data on
screen to highlight). Then this.

---

## 8. Reducing remaining CRUD energy

The user explicitly called out priority 6: places where the product
still slips into admin software. Honest audit:

### Still feels CRUD

1. **/work right-side tail** — owner + time + status (three signals
   same weight). Per the row hierarchy doc, /work should adopt
   *per-band tails*: the OVERDUE band uses the same tail variant
   as /now overdue; the ACTIVE band uses owner-prominent; etc.
   Currently /work uses the `default` tail mode uniformly.
2. **Inbox row composition** — subject + ref + kind chip + body +
   time. Still feels like a notification table. The weighting
   move + filter chips above the list fix this.
3. **Drawer Costs tab** — flat list of cost lines. Could group by
   kind (labor / materials / parts) with subtotals. Tiny upgrade.
4. **Activity strip on /now** — events are time-sorted only. A
   `vendor declined` event reads at the same weight as a routine
   `cost_recorded`. Same fix as inbox: weight per action.
5. **/admin/* surfaces** — kept for the cutover. Stop adding to
   them. Eventually delete.

### NO LONGER feels CRUD

- The drawer (approval + WO) — fully cockpit-shaped.
- /compliance — actively dispatches operational consequence.
- /money sign-offs — decision-shaped, not record-shaped.
- /now lanes — properly partitioned by pressure.

---

## 9. Information hierarchy evolution

The row + drawer evolutions, restated as patterns.

### Row evolution

```
TIER 0 (routine):     [bar] ●  ref  title — location           tail
TIER 1 (high-signal): [bar] ●  ref  title — location           tail
                              optional 1-line subtitle of hints
TIER 2 (urgent):      [bar] ●  ref  URG  title — location      tail
                              optional 1-line subtitle of hints
```

Heights: 32px / ~44px / ~44px. Density preserved on routine; signal
rows compete for the operator's attention by being slightly larger.
The page literally *visualizes* the pressure distribution.

### Drawer evolution (full Tier 3 target)

```
Header: status • ref • title • close
OVERVIEW tab:
  Location
  Status + Priority
  Due + Updated
  Description
  Waiting on sign-off  (when pendingApprovals.length > 0)
  Unit history         (when countLast90d > 0)
  Vendor               (when reliability has any data)
  Tenant               (new, when tenant exists)
  Also here            (when siblingWork.length > 0)
  From inspection      (new, when spawned)
  Dispatch timeline    (new, small dot-strip)
  Move this            (state machine buttons)
TIMELINE tab: existing
```

~12 possible sections; typically 4-6 render per drawer (the others
gated out). Each section is ≤2 lines of prose.

### Activity strip evolution

```
Currently:
  -6m  @SY      marked in progress  WO-1006

Tier 3 (event weighting):
  HIGH  -6m  @SY  blocked            WO-1001   (bold weight)
  STD   -8m  @AR  assigned           WO-1006   (current weight)
  LOW   -2h sys   spawned            WO-1019   (opacity 70)
```

No new component — the existing strip just renders per-event-kind
weight.

---

## 10. Causality opportunities, ranked by feasibility

The user listed eight operational causality examples. Mapping each
to feasibility:

| Example | Have data? | Where it lives | Build cost |
|---|---|---|---|
| Approval blocking dispatch | ✓ | drawer (already), /now needs lane tail | small |
| Leak delaying unit turn | ✗ — no turn date schema | defer | large |
| Vendor holding 4 active jobs | ✓ | drawer (already via VendorBlock); could surface on row | small |
| Repeat plumbing issue | ✓ | drawer (already via UnitHistoryBlock); could surface on row | small |
| Inspection required before move-in | ✗ — no move-in schema | defer | large |
| Related issue at same property | ✓ | drawer (already via ALSO HERE) | done |
| Recurring vendor delay | ✓ (compute from history) | drawer + row hint | medium |
| WO tied to resident move date | ✗ — no move-date schema | defer | large |

**4 of 8 are immediately surfaceable from existing data.** Those go
into Tier 3. The other 4 require schema additions and AppFolio
integration — defer until that integration project starts.

---

## 11. Execution sequencing (the actual sprint plan)

| Sprint | Phase | Days | Why this order |
|---|---|---|---|
| 1 | **/work urgency banding + "Mine" toggle** | 2 | Closes the largest visible gap; structurally independent; quick win that all subsequent work builds on. |
| 2 | **Row-level memory hints (subtitle line)** | 3 | The big cognition-spread move. Reuses Phase A loaders. Lands hints on /now + /work simultaneously. |
| 3 | **Causality across surfaces** | 2 | /now overdue tails pick up downstream; /money approval card gains vendor reliability; /compliance violations expand inline; inbox event weighting. |
| 4 | **Drawer Phase B (tenant + inspection lineage + dispatch timeline)** | 2 | Deepens the strongest surface. Independent of the above. |
| 5 | **Cross-entity hover-highlight (moat)** | 3 | Final layer. Depends on enough relational refs being on screen — needs prior sprints to land first. |

**Total: ~12 engineering days.** Sequence-strict; each unblocks the
next.

If forced to ship one: **Sprint 1 + Sprint 2** together (5 days).
/work becomes a triage surface; rows pick up cognitive hints. That
pair alone is the next felt leap.

---

## 12. Over-design traps

The traps to actively avoid as we build:

### Trap 1 — Row subtitle becomes a paragraph

Risk: every row sprouts 2-3 hints. The page becomes Bloomberg.

Discipline: **max 2 hints per row**, hard cap. **Cap subtitle rows
at ~30% of visible rows** — if more than 30% have hints, the hint
threshold is too generous; tune up.

### Trap 2 — Memory hints become noise

Risk: showing "1st plumbing 60d" everywhere. Operationally
meaningless.

Discipline: **threshold gates**. Don't surface "Nth at unit"
unless N ≥ 2. Don't surface vendor stats unless sample ≥ 5. Don't
say "stale" unless aged ≥ 14d. Tune by operator feedback after
first ship.

### Trap 3 — Hover-highlight is too loud

Risk: hovering a ref lights up the page like a Christmas tree.
Operator goes blind.

Discipline: **5% bg shift maximum**. No animations. Iterate to
"you only notice it if you're paying attention."

### Trap 4 — Banding fragments /work

Risk: /work becomes 8 sub-tables with card containers, borders,
gaps.

Discipline: **inline section headers** only. No card wrappers. No
extra padding between bands. The list stays a list; headers are
interrupts.

### Trap 5 — Causality chips multiply on a row

Risk: a single row gets "blocks INS-A4BC", "delays turn", "vendor
stressed", "3rd plumbing", "pending sign-off" — all visible.

Discipline: **one causality chip per row max**, the operationally
most-pressing. The subtitle hints are different (memory) and capped
at 2.

### Trap 6 — Surface-level memory becomes a sidebar

Risk: someone proposes a "portfolio health" panel.

Discipline: **memory lives embedded in rows + drawers**. Never as
a standalone widget, never as a sidebar, never as a dashboard.

### Trap 7 — Building the moat first

Risk: hover-highlight is the most novel/exciting move. Build it
first → it has nothing to highlight.

Discipline: **ship Sprints 1-3 before 4-5**. The moat gets more
powerful as the surfaces gain richer relational data.

### Trap 8 — Schema gap leakage

Risk: trying to ship "leak delaying unit turn" without
move-out-date data → fake it from heuristics → operator catches a
wrong inference → trust damaged.

Discipline: **only surface what we actually know**. The 4 deferred
causality items wait for real data.

---

## 13. DO NOT BUILD (refreshed for Tier 3 context)

The discipline list is the strategy. New entries based on what's at
risk *now*:

### Already-flagged, still firm

- No analytics / reports / insights page
- No vendor scorecard page
- No portfolio dashboard
- No AI assignment suggestions
- No real-time presence
- No charts, sparklines, gauges, meters
- No theming polish, dark-mode flourishes
- No mobile rebuild
- No calendar/map/timeline views
- No workflow builder
- No custom fields
- No PWA push notifications
- No chat
- No gamification

### New / refreshed for Tier 3

- **No "Trust score" or "Vendor rating" widget.** Reliability is
  inline prose, not a star.
- **No "Maintenance trends" view.** Embedded memory in rows is
  the answer.
- **No "Operational health gauge" anywhere.** No %, no meter, no
  speedometer. Period.
- **No "Live system status" page.** The status line in the top bar
  is enough.
- **No "Notification preferences page" beyond Clerk defaults.**
  Operators don't tune notifications; we tune them with the
  weighting model.
- **No AppFolio mock-integration screens** until the actual
  integration project starts. Don't fake what we don't have.
- **No `/properties/[id]` deep view.** Property context lives in
  drawers and in the property name on rows.
- **No `/vendors/[id]` deep view.** Same.
- **No "drag to reorder" anywhere.** Sort is computed.
- **No save-search / saved views in Tier 3.** Saved views are a
  power-user feature; the urgency-banding pass should reduce the
  need.

### The pattern rule

If a proposed feature could be screenshotted and pitched on a
Linear competitor's marketing site, **it doesn't belong here**.
Stack OS is operational coordination, not feature-complete PM
software.

---

## 14. The strategic stake

After Tier 2 Phase A landed, the product crossed a real threshold:
**the drawer thinks**. An operator opening any WO sees the unit's
history, the vendor's reliability, and sibling work — facts they
would otherwise have to assemble in their head.

Tier 3's bet is that **this kind of cognition belongs on the rows
too**. Not in a separate "analytics" surface. Not in a sidebar. Not
behind a tab. In the row itself, as a subtitle line, when (and only
when) there's something operationally non-obvious to say.

Why this is the right bet: the operator's actual cognitive load
isn't reading rows. It's *holding context in their head while they
read rows*. Every memory hint we land on a row is one fewer thing
the operator has to remember themselves. That compounds.

The moat — the cross-entity hover-highlight — is what makes this
felt as *one connected operation*, not five surfaces. Done right,
nobody else in this market can match it without rebuilding their
data model. Done wrong, it's clutter.

Both halves matter equally. Build them in order. Hold the
discipline.

---

## What to do next

If you want to start: **Sprint 1 (/work urgency banding).** Smallest
unit of work with the largest visible delta. Two days. Independent
of everything else. After it lands, the most-trafficked surface
finally reads as a triage queue, not a database table.

If you want to defer all building and walk the live product first:
the test is to spend twenty minutes on `stack-os-six.vercel.app` at
9am Tuesday and see what your eye lands on. If /work is where it
stalls, Sprint 1 is right. If the drawer feels good but rows feel
flat, Sprint 2 (row-level memory hints) is right. The screenshots
in `test/screenshots/tier2-A/` should match what you see — if they
don't, that's the real signal about where to invest.

The architecture is right. The taste is right. The product
philosophy is right. The remaining work is teaching the system to
*be obvious* about what it already knows.
