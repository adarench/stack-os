# Lane Behavior Model

**Companion to:** [[p9_cockpit_strategy]], [[pressure_first_product_model]],
[[cockpit_information_hierarchy]]
**Scope:** the most concrete P9 doc. Each lane gets a distinct morphology;
an implementer can write each lane's row projection without re-deciding
shape.

---

## Current problem

All six lanes on `/now` use the same `EntityRow` component. The differences
between lanes today are limited to `tailMode` variants (which fields appear
in the right tail). The lane *itself* — the row's left side, mid section,
and reading order — is identical across all six lanes.

This makes lanes feel structurally similar. An OVERDUE row visually
resembles a JUST CHANGED row. The operator has to read text to tell them
apart, which violates the silhouette-first principle in
[[cockpit_information_hierarchy]].

`surface_by_surface_critique.md` flagged this directly: *"Row tail uniform
across surfaces (should be lane-specific)."* The same critique applies
within `/now` between lanes.

---

## Proposed evolution

Introduce a **lane projection** — a typed shape that the `EntityRow`
accepts and uses to drive composition. The component stays one; the
*projection* varies per lane.

```
type LaneProjection =
  | { kind: 'overdue' }
  | { kind: 'blocked' }
  | { kind: 'in_flight' }
  | { kind: 'just_changed' }
  | { kind: 'needs_you' }
  | { kind: 'today' }
```

The projection is a *name* on the type-level. The component reads it and
chooses which fields to render, in which order, at which emphasis.

Per-lane specifications follow. Each lane is described with:

- **Feel** (one phrase)
- **Visual shape** (silhouette description)
- **Row composition** (left → right)
- **Lane header aside** (one-line operational summary)
- **Expansion rule** (which rows expand to show consequence inline)
- **Sort order**

---

## OVERDUE

**Feel:** *dangerous.* The lane should feel like the first place the
operator's eye lands. Loud header. Red bar. Pulse on the oldest row only.

**Visual shape**

- Lane background: subtle red tint (5% opacity)
- Lane header: red label, count in red
- Severity bar on every row: red 3px
- Top row (oldest) has a single pulsing urgency dot; remaining rows
  static

**Row composition (left → right)**

```
[3px red bar] ● REF  [URG?]  Title — Property · Unit
                                            [consequence chip] [owner] [aging]
```

- Top-3 rows: **expanded** — consequence chip rendered inline in the tail
  ("blocks 3 WOs", "delays turn", "life-safety", or nothing if none).
- Rows 4–6: **collapsed** — no consequence chip, owner + aging only.
- Row 7+: redirect to `+ N more → /work?lane=overdue`.

**Lane header aside**

```
OVERDUE  •  7   oldest 14d · 3 block a turn
```

The aside is mandatory; if there's no consequence aggregation, fall back
to `oldest Nd`.

**Expansion rule**

Top 3 rows by sort order get consequence chip. Operators almost always
act on the top 3; surfacing consequence inline saves the drawer-trip
for triage decisions.

**Sort order**

`priority DESC → consequence_count DESC → dueAt ASC`

The current sort is `priority DESC → dueAt ASC`. P9 inserts consequence
as the second key — a 12d urgent WO that blocks 5 others outranks a 14d
urgent WO that blocks nothing.

---

## BLOCKED

**Feel:** *constrained.* Not dangerous — these are waiting on something.
The lane should feel like a queue of unblock-actions, not a queue of
emergencies.

**Visual shape**

- Lane background: subtle amber tint (4% opacity)
- Lane header: amber label, count in amber
- Severity bar on every row: amber 3px
- No pulse anywhere — blockage is patient, not urgent

**Row composition (left → right)**

```
[3px amber bar]  REF  Title — Property
                                  [reason chip] [owner] [waiting Nd]
```

- Reason chip dominates the tail. "waiting on parts", "waiting on
  landlord", "waiting on tenant access", "awaiting approval", "no COI".
- Owner shown after reason chip.
- Time chip shows duration-in-blocked, not aging since creation.

**Lane header aside**

```
BLOCKED  •  9   5 waiting on parts · 2 on landlord · 1 no COI
```

The aside summarizes by reason. Operators triage blocked rows by reason,
not by individual WO — *what's the next batch of unblock-actions?*

**Grouping rule**

When ≥3 rows share a reason, render them as a **mini-cluster**:

```
waiting on parts (4)
  WO-1031  Bathroom faucet replacement
  WO-1042  Garbage disposal swap
  WO-1058  Outlet repair · Cedar Ridge 3B
  WO-1063  Water heater replacement
```

Grouping is visual only — each row is still individually clickable.

**Sort order**

`blocked_reason ASC (alphabetical) → blocked_since ASC (oldest first)`

Grouping by reason naturally bubbles up the longest-blocked cluster.

---

## IN-FLIGHT

**Feel:** *throughput-oriented.* These are actively being worked. The
lane should feel like a status board, not an emergency queue.

**Visual shape**

- Lane background: none (default)
- Lane header: default tone, count in default
- **No severity bar.** Active work is not severity by definition.
- Owner emphasized; aging de-emphasized

**Row composition (left → right)**

```
●  REF  Title — Property                   [owner large] [4h45m active]
```

- Owner gets larger weight than other lanes (right-aligned avatar +
  name).
- Time chip shows **active duration** (since `in_progress` transition),
  not aging.
- Unassigned rows render a `unassigned` chip in red — these are the
  only loud rows in this lane.

**Lane header aside**

```
IN-FLIGHT  •  12   3 unassigned · oldest active 6d
```

**Expansion rule**

Only unassigned rows expand. Assigned rows are intentionally compact —
the operator's job here is to find unassigned ones, not to read assigned
ones.

**Sort order**

`unassigned FIRST → activeDuration DESC`

Unassigned rows surface first because they represent operator-personal
pressure (someone needs to assign them).

---

## JUST CHANGED

**Feel:** *ephemeral.* These are recent state transitions; the operator
glances to confirm progress and moves on. The lane should feel like a
ticker, not a queue.

**Visual shape**

- Lane background: none (default)
- Lane header: default tone, label includes "last 24h"
- Severity bar: none
- Rows render at **lower contrast** — text is `quiet` neutral 400
- Rows fade visually as they approach 24h (gradient on `lastActionAt`)

**Row composition (left → right)**

```
REF  Title — verb · 2h ago by owner
```

- Single-line. No subtitle. No consequence chip.
- Action verb in mono-micro ("assigned to Stark", "marked in progress",
  "resolved by Garcia").
- Time in mono-micro at the right edge.

**Lane header aside**

```
JUST CHANGED  •  18   8 resolved · 4 assigned · 2 blocked · 4 status
```

Verb summary; helps the operator see the *shape* of the morning's
activity without reading rows.

**Expansion rule**

None. JUST CHANGED never expands.

**Collapse rule**

Show 3 rows max. Overflow becomes `+ N more → /work?recent=24h`. Most
mornings the operator doesn't read JUST CHANGED at all — it's there
for the case when they want to verify "did Stark actually close that?"

**Sort order**

`lastActionAt DESC`

---

## NEEDS YOU

**Feel:** *operator-personal.* The operator viewing the screen owns
something here. The lane should feel like a personal todo list, not
a queue.

**Visual shape**

- Lane background: subtle indigo tint (3% opacity) — actor color
- Lane header: indigo label, count in indigo
- Severity bar: indigo 3px on every row (different hue from OVERDUE's
  red — different category of pressure)
- Row prefix carries "you · " in indigo

**Row composition (left → right)**

```
[3px indigo bar]  you · approve $5,400  WO-1043  Hallway repaint
                                          [unblocks WO-1051] [2d waiting]
```

- Prefix is the verb the operator must do: `approve`, `assign`,
  `review`, `reply`.
- Ref + title come after prefix, not before.
- Consequence chip surfaces aggressively — these are the operator's
  highest-leverage decisions.

**Lane header aside**

```
NEEDS YOU  •  4   $12,400 in approvals · oldest 2d
```

**Expansion rule**

Every row in NEEDS YOU is expanded (consequence chip shown). This lane
is small by definition; density is not the constraint.

**Sort order**

`consequence_count DESC → amount_cents DESC → waiting_since ASC`

What unblocks the most, weighted by money, then by age.

---

## TODAY

**Feel:** *time-anchored.* These are scheduled for today (or due
today). The lane should feel like a calendar, not a queue.

**Visual shape**

- Lane background: subtle sky tint (3% opacity) — recency color
- Lane header: sky label
- Severity bar: none (unless a row is also OVERDUE — but overdue
  always wins lane assignment)
- Left of ref: **scheduled time** in mono-micro ("2:30p", "—" if
  no time)

**Row composition (left → right)**

```
2:30p  REF  Title — Property · Unit    [owner] [scheduled / due]
```

- Time anchor is the dominant left element. Sorted by time, the lane
  reads top-to-bottom as a day-plan.
- If multiple rows share a time (e.g., 10:00a × 3), they cluster
  visually.

**Lane header aside**

```
TODAY  •  8   next 2:30p · 2 unassigned
```

**Expansion rule**

Only the **next** scheduled item expands (consequence chip + property
context). Rest collapse.

**Sort order**

`scheduled_time ASC → priority DESC`

Items with no scheduled time sort to the bottom of the lane.

---

## Lane projection summary table

| Lane | Severity bar | Tail dominant | Header aside | Expand |
|---|---|---|---|---|
| OVERDUE | red | consequence chip | oldest + block-count | top 3 |
| BLOCKED | amber | reason chip | reason summary | by group |
| IN-FLIGHT | none | owner + active duration | unassigned + oldest active | unassigned |
| JUST CHANGED | none | action verb + time | verb summary | none |
| NEEDS YOU | indigo | consequence chip | $ + oldest | all |
| TODAY | none | scheduled time on left | next time + unassigned | next only |

---

## Operational reasoning

### Why lane-as-mental-model

Operators don't think "I have 47 WOs." They think "I have an overdue pile,
a blocked pile, an in-flight pile, and a few things I owe people."
Pile-shape is the mental model. Making lanes structurally distinct
matches the mental model at the perceptual layer.

### Why projection, not separate components

We considered six different row components (OverdueRow, BlockedRow, etc.).
Rejected for two reasons:

1. Maintenance burden: six components that share 80% of their code
   diverge over time.
2. Cross-row consistency: hover behaviors, click-to-drawer, selection,
   keyboard navigation should be identical. A projection prop on one
   component enforces that for free.

The projection drives **field composition** (which fields, what order)
and **emphasis** (which fields are larger / smaller / dropped). It does
not drive interaction. Interaction stays uniform.

### Why some lanes have no severity bar

Severity bar is the silhouette signal for *pressure-of-state*. IN-FLIGHT,
JUST CHANGED, and TODAY are not pressure-of-state lanes — they're
informational lanes that exist to help the operator understand throughput
and timing. Adding severity bars to them dilutes the bar's meaning.

This is a discipline call: severity bar means "this row needs action
now." If it appears on a JUST CHANGED row, the operator loses trust in
the signal.

---

## Tradeoffs

### Risk: per-lane projection explodes the row component

`EntityRow` already handles tail modes, urgency dots, priority chips,
hints subtitle, owner. Adding 6 projections risks a 400-line monster.

Mitigation: extract a `LaneProjection` factory module that returns the
right composition for a given projection kind. The row component reads
the factory output and renders, but doesn't branch on lane internally.

Approx interface:

```
projection.left  → React node (severity bar or time anchor or none)
projection.prefix → React node (you-tag or nothing)
projection.tail  → ordered list of tail elements (consequence | reason |
                  owner | time-anchor | active-duration)
```

### Risk: lane visual differentiation overshoots into "decoration"

If lanes are too visually distinct, the screen looks like six different
products. We're picking pressure-tone tints at 3–5% opacity precisely
to avoid this — the lanes feel *related but distinct*, like instruments
in the same orchestra.

If a contributor proposes brighter lane backgrounds (10%+), reject —
that violates the calm-by-default principle in `operator_ux_principles.md`.

### Risk: consequence chip availability varies wildly

OVERDUE and NEEDS YOU rely on consequence-chip data. If the consequence
loader is empty for most rows, those lanes look sparse where the doc
promises depth.

Mitigation: ship consequence loaders in priority order — start with
"blocks N WOs" (deterministic from existing schema), then "delays turn"
(requires project linkage, already in P4), then "tenant-impact" (already
flagged in Tier 3 work). Don't over-promise.

### Risk: TODAY lane requires schedule data we don't fully have

Currently `work_orders.due_at` is set but `scheduled_for` is not a
first-class field. The TODAY lane's left-anchored time depends on this.

Mitigation: in the first cut, TODAY uses `due_at` as the time anchor
(due-by-today) and labels it as such. A future schema bump can add
`scheduled_for` for inspections + projects without breaking the
projection.

---

## Companion docs

- [[p9_cockpit_strategy]] — strategic framing
- [[pressure_first_product_model]] — what drives lane assignment
- [[cockpit_information_hierarchy]] — visual hierarchy each projection
  obeys
- [[operator_attention_model]] — how the operator moves between lanes
- [[p9_execution_plan]] — where lane projection lands in the
  implementation sequence (Stage B)
