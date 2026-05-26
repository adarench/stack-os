# Cockpit Information Hierarchy

**Companion to:** [[p9_cockpit_strategy]], [[pressure_first_product_model]]
**Scope:** what the eye lands on, in what order, on every operator surface.

---

## Current problem

The shell shipped through Tier 1–3 has the right *components* (severity
bar, urgency dot, owner avatar, mono ref, title, hints subtitle) but the
*reading order* still mirrors the source schema — ref first, title second,
status third. That ordering optimizes for **identifying a record**, not
**perceiving pressure**.

`visual_hierarchy_audit.md` flagged this as the root cause of the "still
transactional" feel on `/work`, `/compliance`, and `/inbox`: visually,
nothing tells the eye where to land first. Severity bars exist but only
on some lanes. Consequence is invisible. Owner is in the tail.

---

## Proposed evolution

A single, ordered visual hierarchy used on every operator surface. The
eye should land in this order without effort, in under 200ms per row:

### The 6-tier hierarchy

1. **Lane membership (zone-level)** — Before any single row, the operator
   perceives *which zone is loud*. Lane header weight + lane background
   tint communicate the silhouette. A red OVERDUE header at the top
   means "start here." Empty or quiet lanes are visible but recede.

2. **Severity bar (3px left edge)** — Already shipped. Extends to every
   pressure-bearing lane: red for tier-1 pressure (life-safety, urgent
   priority, overdue + consequence), amber for tier-2 (high priority,
   blocked + aging), invisible for normal rows. Severity bar is **the
   silhouette signal** — it should be perceptible from peripheral vision
   with the operator's eyes on a different part of the screen.

3. **Urgency dot (8px)** — Already shipped. Stays adjacent to ref for
   continuity. Pulses only on the single oldest row in OVERDUE; never
   batch-pulses (motion theatre is rejected).

4. **Consequence chip (new)** — In the row tail, ahead of owner. "blocks
   3 WOs", "delays turn", "tenant-occupied", "life-safety". This is
   the new load-bearing pressure element. Without it, the cockpit
   underweights downstream impact.

5. **Owner avatar / name** — Already shipped via the Tier 3 assignments
   join. Right-aligned in tail, after consequence chip. "Who's on it?"
   answered without click.

6. **Ref + title** — The cheapest identity layer. Small, monospace ref
   (e.g. `WO-1043`); title in slightly larger sans. These are the
   **last** things the eye lands on, not the first.

### Why this order

The first three tiers are perceived at **silhouette** — the eye sees
shape and color before character. The next two are perceived at
**glance** — short reads, no parsing. The last is perceived only when
the operator commits to acting on this row.

This inverts the current reading order. Today the eye reads ref first
(it's leftmost, mono, bright) and pressure last (consequence isn't even
present). After P9 the eye reads pressure first and identity last.

---

## Typography tiers

Four sizes. No more. No display-bold for "pressure moments" (rejected —
adds noise without information).

| Tier | Size | Family | Used for |
|---|---|---|---|
| Mono-micro | 11px | mono | timestamps, refs, time-anchors ("2:30p") |
| Mono | 12px | mono | row tail chips, consequence chip, owner |
| Sans-body | 13px | sans | row title, drawer body |
| Sans-emph | 14px medium | sans | lane header label, drawer block titles |

No 16px+ anywhere in the cockpit. Density wins.

---

## Color palette extension

The current palette is three colors: red (urgency), amber (warning),
neutral (default). P9 adds:

| Token | Hue | Used for |
|---|---|---|
| `urg-overdue` | red 600 | overdue, life-safety, tier-1 pressure (existing) |
| `urg-blocked` | amber 500 | blocked, aging, tier-2 pressure (existing) |
| `consequence` | violet 500 | consequence chip text/border |
| `actor` | indigo 500 | operator-personal pressure (NEEDS YOU prefix, you-tag) |
| `recency` | sky 500 | JUST CHANGED lane tint, recent-action verb |
| `quiet` | neutral 400 | backlog rows, deep-lane rows |

Six tokens total. Each tied to one operational meaning. No additional
hue for category, priority, or status — those collapse into the existing
tokens.

### Color discipline

- A row carries at most **two** colored elements (severity bar +
  consequence chip, or NEEDS YOU prefix + consequence chip). More than
  two and the row looks decorated.
- Empty / quiet lanes use no color at all. Their silhouette is
  intentionally pale so the loud lanes pop.
- Hover-graph tint is 6% opacity — barely visible, but enough to feel
  connection. Never animate the tint in; just present it.

---

## Density discipline

### Above-the-fold targets

| Viewport | Target items visible on `/now` |
|---|---|
| Desktop 1440×800 | ≥12 rows across the loud lanes |
| Laptop 1366×768 | ≥10 rows |
| Mobile 375×667 | ≥6 rows including the active lane header |

To hit these targets:

- Row height stays 32–36px on desktop; 40px on mobile (touch target).
- Inter-row gap is 0 (edge-to-edge); inter-lane gap is 16px.
- Lane headers are single-line, 28px tall.
- Top bar + activity strip combined ≤ 56px.

### "Show N more" rule

Each lane caps visible rows at **6** by default. Overflow collapses to a
single-line `+ 4 more → /work?lane=overdue` link. This is the only place
where `/now` defers to `/work` — it's the bridge from cockpit to
power-lens.

### Backlog never on /now

If an entity has zero pressure dimensions it does not appear on `/now`,
period. It lives in `/work?backlog=show`. The pressure-first principle
means the cockpit only shows things with pressure.

---

## Operational reasoning

### Why silhouette before character

Operators don't read the cockpit linearly. They scan. The first 500ms
of looking at `/now` is silhouette-recognition: "where is it loud?"
The next 500ms is glance-reading: "what's the pressure?" Only after
those 1000ms does the operator commit to reading a row in detail.

Putting ref + title first forces character-reading immediately, which
slows the silhouette pass. Putting severity bar + consequence chip first
keeps the silhouette pass intact. Ref + title arrive when the operator
asks for them — i.e., when they're about to click.

### Why so few colors

Each color costs cognitive load. Six tokens is already at the upper limit
of distinguishable-at-silhouette. AppFolio uses ~14 colors across its
interface; the operator can't pre-attentively distinguish them. Stack OS
prefers fewer colors used with discipline over more colors used freely.

### Why consequence ahead of owner

Owner answers "who's responsible." Consequence answers "what happens if
we don't act." For an 8am scan, consequence weights heavier — the
operator wants to know *what to fix first*, not *who's on it first*.
Owner stays in the tail because once the operator has decided to act,
they need to know who to talk to.

---

## Tradeoffs

### Risk: consequence chip eats the right tail

The tail is already loaded (owner + time + status). Adding a consequence
chip risks overflow. Mitigations:

- Consequence is **lane-conditional**: shown on OVERDUE + NEEDS YOU, hidden
  on JUST CHANGED + TODAY (where consequence is less load-bearing).
- When consequence is shown, **time chip is dropped** from the tail —
  age is already encoded by lane membership.
- When consequence is shown on a normal-priority row, severity bar may be
  suppressed (consequence is itself a severity signal).

### Risk: silhouette discipline is hard to enforce at scale

If contributors add a third color to a row "just this once," the
silhouette collapses. Mitigations:

- Only `EntityRow` can render colored chips; all color usage goes through
  a typed `ChipTone` enum.
- A `RowComposition` lint (just a code review checklist) rejects PRs that
  introduce new color tokens.
- The umbrella doc names this constraint explicitly so reviewers can cite
  it.

### Risk: density discipline breaks on mobile

40px row height + ≥6 rows + header + top bar exceeds 667px. Mitigations:

- Mobile drops the activity strip into the rail menu (it's not load-
  bearing on small screens).
- Mobile shows one lane at a time with horizontal swipe to next lane
  (defer if scope expands).
- Acceptable fallback: mobile shows the top 4 rows per lane, scroll for
  more.

---

## Companion docs

- [[p9_cockpit_strategy]] — the umbrella
- [[pressure_first_product_model]] — what's being rendered
- [[lane_behavior_model]] — how the hierarchy varies per lane
- [[card_list_hybrid_exploration]] — why rows, not cards
