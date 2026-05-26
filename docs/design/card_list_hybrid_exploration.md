# Card / List Hybrid Exploration

**Companion to:** [[p9_cockpit_strategy]], [[cockpit_information_hierarchy]],
[[lane_behavior_model]]
**Scope:** rejects cards. Justifies the minimal-list archetype with
selective row-level expansion. Names the rules that prevent drift back
toward cards.

---

## Current problem

The mockup direction the user pointed at (and many "modern operations
tool" references — Linear, Height, Pipefy) blends cards and lists.
Operators see this and reach for the same affordance: *let's give each
row a card-like background, padding, and a richer mid-section.*

This is a trap. The Stack OS shell currently uses **edge-to-edge minimal
rows** (no fill, no shadow, no isolation). That is correct, and any drift
toward cards would degrade the product.

The genuine question is: how do we get **card-like information depth
on the rows that need it** without giving up the **list-like density
that the cockpit requires**?

---

## Proposed evolution

A **minimal list with selective expansion**. Three rules:

### Rule 1: Rows are not cards

Specifically:

- No background fill
- No drop shadow
- No border-radius
- No internal padding isolation
- No drag-handle, no checkbox-by-default, no "card chrome"

Rows stack edge-to-edge with `space-y-0`. Hover yields a `bg-muted/40`
highlight. That's the entirety of the row's container.

### Rule 2: Top-of-lane rows expand; deep-lane rows collapse

A lane is not uniform. The first 3 rows of OVERDUE are where 90% of
operator attention lands. Those rows can afford an extra render-pass —
the consequence chip in their tail, an optional sub-subtitle hint, the
unit context spelled out.

Rows 4–6 of the same lane collapse — single line, lower contrast, no
chip, no hint. They exist for completeness; they don't need silhouette
weight.

Rows 7+ become `+ N more → /work?lane=overdue`.

This produces a gradient inside the lane: dense pressure at the top,
fading toward backlog at the bottom. The eye reads the gradient
without effort.

### Rule 3: Backlog never on /now

Anything with zero pressure dimensions lives on `/work?backlog=show`,
not on `/now`. The cockpit only shows rows with pressure. This is
the load-bearing rule that lets us stay at minimal-list density —
without it, lanes drown in backlog and contributors will reach for
card chrome to "make rows breathe."

---

## Why cards lose

### Cards encode the wrong mental model

Cards represent **discrete units of work that move through stages** —
the Trello / Jira / Asana mental model. That's correct for project
management where:

- Items are uniform in shape
- The state machine is short (~5 statuses)
- Drag-drop is the primary interaction
- Card-as-noun ("this card", "move the card") is the operator's
  language

None of those hold for Stack OS:

- Items vary wildly in shape (a tenant insurance renewal has 3
  meaningful fields; an active emergency leak has 12)
- The state machine is long and entity-specific (10 statuses for WOs,
  5 for inspections, 6 for projects)
- Drag-drop is rejected (gimmick; user-stated)
- Operator language is "this WO", "this approval", "this finding" —
  never "this card"

### Cards cost density

A minimal row at 32–36px gives `/now` 12–18 rows above the fold on
desktop. A card row at typical PM-tool height (72px) gives 5–8.

[[operator_attention_model]] specifies the morning loop needs 8–12
decisions in 60–90 seconds. That's not possible at card density.

### Cards multiply chrome

Once a row has a background, contributors add padding. Padding implies
internal sections; sections demand dividers. Dividers create hierarchy
inside the card, which competes with hierarchy across lanes. Within six
months a card-based cockpit looks like a CRM.

The minimal-list constraint is the discipline that prevents this slow
collapse.

---

## What "selective expansion" actually looks like

Per lane, expansion is governed by [[lane_behavior_model]]. The patterns:

### Tier-1 expansion (top of OVERDUE, all of NEEDS YOU)

- Row stays single-line.
- Tail carries a **consequence chip** (`blocks 3 WOs`) — text-sized,
  not card-sized.
- Subtitle line (12px mono, optional) carries one row-hint
  (`3rd plumbing 90d` from Tier 3 work).

The row is still 32–40px. The expansion is *information density*, not
*physical size*.

### Tier-2 expansion (BLOCKED rows in a cluster)

- Reason-grouped cluster gets a single 16px header label
  (`waiting on parts (4)`), then 4 single-line rows underneath.
- The cluster header is **not** a card — no fill. Just a label with
  a count.

### Tier-3 expansion (NEEDS YOU prefix verb)

- Row prefix carries `you · approve $5,400` in indigo.
- The prefix takes a small chunk of left horizontal space; the rest
  of the row composes normally.

Notice that in every "expansion" case, **the row stays single-line**
(or single-line plus a 12px subtitle). Expansion is always about
*adding signal density inside the row's existing footprint*, never
about growing the row's vertical size.

---

## What variable-height rows would look like (rejected)

`implementation_priority_order.md` mentioned variable-height approval
cards as a Tier 2 polish item. We're rejecting that for `/now` proper:

- Variable height on `/now` makes the lane visually unstable — adding
  a row that's 2× height shifts every row below it.
- Operators learn to scan by absolute position; height variation breaks
  that learning.
- The approval cockpit (inside the drawer) can carry richer layout —
  the drawer is where variable height is acceptable. The list is where
  uniform height is required.

This is a tradeoff. The drawer is the cockpit; the lane is the queue.
The lane must stay regular.

---

## Density targets (reprise from [[cockpit_information_hierarchy]])

| Viewport | Target on /now |
|---|---|
| Desktop 1440×800 | ≥12 rows visible |
| Laptop 1366×768 | ≥10 rows |
| Mobile 375×667 | ≥6 rows |

Achieving these requires:

- 32–36px desktop row height (40px mobile for touch)
- 0 inter-row gap (edge-to-edge)
- 16px inter-lane gap
- Lane headers single-line, 28px
- Top bar + activity strip combined ≤56px
- No background fills, no shadows, no borders inside rows

---

## Operational reasoning

### Why edge-to-edge

Edge-to-edge rows have a side effect that's worth naming: they make the
**lane** feel like the unit, and the **row** feel like an item within
the lane. That's exactly the mental model the product wants. Cards
make the row feel like the unit, which contradicts the
pressure-zone framing.

### Why a 12-row floor on desktop

12 rows × 6 lanes = 72 row-slots above the fold. That's roughly the
total number of *items with pressure* an operating dispatcher has in
their head on a given morning. Hit the 12-row target and operators can
hold their morning in one screen, no scroll.

Drop below 8 rows per screen and the cockpit becomes a navigator
("scroll to find what's next") instead of an overview. That's the
"transactional feel" the audit flagged.

### Why selective expansion beats uniform density

Two alternatives we considered and rejected:

1. **All rows uniform-dense.** Pro: predictable. Con: top-of-lane
   pressure rows have no room to surface consequence; operator opens
   drawer to find out, slowing the morning loop.
2. **All rows expanded.** Pro: maximum information. Con: density
   collapses, fold-density target missed, operator scrolls.

Selective expansion threads the needle. Top-of-lane rows are
information-rich precisely where attention lands. Deep-lane rows are
information-sparse precisely where attention has already moved on.

---

## Tradeoffs

### Risk: contributors will misread "expansion" as "cards"

Once we ship consequence chips and subtitle hints, the next PR will
propose "let's give the expanded rows a subtle background to set them
apart." Reject. Mitigation: this doc names the rule explicitly so
reviewers can cite it.

### Risk: minimal-list is *boring*

Stakeholders new to the product will say "it looks unfinished" because
it lacks the visual polish of card-based PM tools. This is the cost of
discipline. The product is for daily operators, not for screenshots.

Mitigation: the lane-tone tints (3–5% opacity from
[[cockpit_information_hierarchy]]) give the cockpit just enough color
texture to feel finished. The severity bar, consequence chip, urgency
dot, and owner avatar provide visual variety inside the discipline.

### Risk: mobile struggles with selective expansion

A 32px row on desktop is fine; on a 375px-wide phone screen, the
consequence chip + owner + time in the tail risks line-wrapping.

Mitigation:

- Mobile drops the time chip from the tail (already implicit in lane
  membership).
- Mobile renders consequence chip as a leading row prefix instead of
  trailing, when present.
- Mobile drops the activity strip into the rail menu.

The phone walkthrough in [[p9_execution_plan]] Stage G is the moment to
re-tune these rules against real device behavior.

### Risk: this disagrees with the mockup direction

The user mentioned a mockup direction that "suggests compressed
operational tiles." Tiles ≈ cards. We're choosing not to mirror that
direction.

Justification:

- The user also explicitly rejected card and drag-drop affordances in
  the P9 brief.
- The density math doesn't work for tiles at the loops described in
  [[operator_attention_model]].
- The minimal-list archetype, executed well (consequence chips,
  severity bars, selective expansion, lane tints), produces an
  experience operationally richer than tile-based competitors.

If after the phone walk the user wants to revisit tile aesthetics, we
revise. But we go in with rows.

---

## Kanban: the only card-shaped concession

The kanban view on `/work?view=board` is the only surface where columns
+ card-shaped rows survive. It serves the dispatcher's *visual mental
model* — "I have these cards moving through these columns."

But:

- Drag-drop is removed (gimmick; user-stated).
- Cards in the kanban are still **minimal** — no card fill, no shadow,
  just a left-edge severity bar and the same EntityRow content
  rotated into a column.
- `s` (status menu) + Shift-select replaces drag-drop. Same outcome,
  keyboard-driven.

Kanban is allowed because it's a dedicated power-user surface, not
because cards are good. See [[p9_cockpit_strategy]] section on Kanban
reframe.

---

## Companion docs

- [[p9_cockpit_strategy]] — strategic framing
- [[cockpit_information_hierarchy]] — the visual rules cards would
  have violated
- [[lane_behavior_model]] — the lanes that expansion happens within
- [[operator_attention_model]] — the loops density supports
- [[p9_execution_plan]] — Stage B (lane projection) is where these
  rules become code
