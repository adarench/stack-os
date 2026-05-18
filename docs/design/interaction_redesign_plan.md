# Interaction Redesign Plan

**Scope:** every input mode (mouse, keyboard, batch, drawer behavior,
command palette, undo, optimistic state). Concrete patterns, not
philosophy. The principles doc explains the why; this is the what.

---

## 1. Keyboard model

Today: ⌘K only. Everything else mouse.

### Proposed keyboard map

**Global (any surface):**
| Key | Action |
|---|---|
| `⌘K` | Command palette (existing) |
| `?` | Show keyboard map overlay |
| `g` then `n` | Go to /now |
| `g` then `w` | Go to /work |
| `g` then `c` | Go to /compliance |
| `g` then `m` | Go to /money |
| `g` then `i` | Go to /inbox |
| `⌘[ / ⌘]` | Back / forward in surface history |
| `⌘Z` | Undo last action |

**Inside a list (any row-based surface):**
| Key | Action |
|---|---|
| `j` / `↓` | Next row |
| `k` / `↑` | Previous row |
| `o` / `enter` | Open drawer for current row |
| `space` | Quick-preview drawer (peek, doesn't change URL) |
| `x` | Select row (for batch ops) |
| `shift+j` / `shift+k` | Select range |
| `esc` | Close drawer / clear selection |
| `f` | Focus the filter chip bar |
| `/` | Focus the search input (top bar) |

**Inside the drawer (WO/INS/PRJ):**
| Key | Action |
|---|---|
| `c` | Open comment composer (cursor in textarea) |
| `s` | Open status menu (the "MOVE THIS" buttons get keyboard focus) |
| `a` | Open assign picker |
| `t` then `1..4` | Switch to tab N (Overview/Timeline/Costs/Files) |
| `⌘↵` (in textarea) | Post comment (existing) |
| `⌘shift+c` | Toggle comment visibility internal ↔ vendor |

**Inside the drawer (approval):**
| Key | Action |
|---|---|
| `y` | Sign off |
| `n` | Reject |
| `c` | Add a note (composer opens with focus) |

**Inside command palette:**
| Key | Action |
|---|---|
| `↑` / `↓` | Navigate results |
| `enter` | Execute |
| `⌘enter` | Execute in background (don't navigate) |
| Type a ref (`WO-1043`) | Direct jump |

### Discoverability

- `?` overlay shows the full map, grouped, with chord support.
- Every actionable button in the UI gets a `kbd` tooltip on hover.
- New users see a one-time toast: "Press `?` to see all shortcuts."

**Reference:** Linear, Superhuman, Notion (the trio that proved
keyboard-first scales beyond power users).

---

## 2. Row selection + batch operations

Today: no selection. Every action is one row at a time. This is fine
for occasional users; it's not fine for dispatchers at 9am Tuesday
handling 30 ticket triage.

### Proposed batch model

- `x` on a focused row toggles selection.
- `shift+click` and `shift+j/k` for range select.
- When ≥1 row is selected, a **batch action bar** slides up from the
  bottom (Linear pattern): "5 selected · Assign · Move status ·
  Comment · Snooze · Tag · Cancel".
- `esc` clears selection.
- Selected rows get a faint left-side stripe (separate from the
  priority bar; could be the right side of the row instead).

### Batch operations to support

- **Assign to vendor / staff** — most common batch op
- **Change status** — mark 5 routine items "scheduled" at once
- **Add comment to all** — "vendor confirmed all 5 for Wednesday"
- **Snooze** — push out 3 low-priority items to next week
- **Tag / label** — optional

Operations that should NOT be batched:
- Approve (each decision is its own context)
- Delete (too dangerous)
- Comment with @mentions (each thread is its own context)

---

## 3. Drawer redesign — from modal to docked split

Today: right-side sheet, ~540px, overlays the page, blocks
backdrop.

### Proposed: three drawer states

1. **Closed** — no drawer, full page (current default state).
2. **Docked split** — list shrinks left, drawer occupies right half.
   Reading + acting at the same time. Triggered by clicking a row
   or pressing `enter`. This becomes the dominant working mode.
3. **Modal overlay** — full-width drawer for deep work (composer,
   long discussion threads). Triggered by `⌘O` from the docked
   view, or by clicking a "expand" button in the drawer header.

State 2 is the keystone. It's the operator's daily mode.

### Pinning

- A pinned drawer survives row navigation. Operator can `j/k`
  through 10 rows in the left list while the drawer stays on the
  one they're examining.
- Up to 3 drawers can be pinned simultaneously (Superhuman split
  list pattern). The pinned drawers stack on the right; clicking
  swaps focus.
- A pinned drawer in the list margin shows as a small chip with
  the ref + status dot.

### Drawer header should carry actions

Today the drawer header is `[urgency dot] [ref] [title] [close]`.
Add a compact action toolbar to the right of the title:
- For WO: `[assign] [status ▾] [⋯ more]`
- For approval: `[sign off ✓] [reject ✗]` — yes, in the header,
  so the operator can decide without scrolling
- For inspection: `[start walk]` if scheduled, `[review]` if
  completed

### "Open in new tab" / `⌘click`

A drawer-as-page mode for deep work. `⌘click` a row → opens the
full entity detail in a new tab. This is the existing
`legacyHref`. Make it discoverable.

---

## 4. Inline row actions

Today: rows are click-to-open. No actions inline.

### Proposed: hover reveals 3 quick actions

When hovering a row (mouse) or focusing it (keyboard), three icons
appear in the right margin:
- **`👥 Assign`** — opens a popover picker
- **`💬 Comment`** — opens an inline composer (slides down below
  the row)
- **`⋯ More`** — opens a context menu for status change,
  snooze, etc.

Only show on hover/focus so the row stays calm at rest.

### Inline status menu

Clicking the status text on a row (e.g., the right-side
"blocked" word) opens a tiny menu of valid transitions. Operator
moves a WO from `triaged → assigned` without opening the drawer.

This is the most operator-y interaction the product can offer.
Linear-style.

### Inline comment composer

The inline composer (triggered by `c` or the comment icon) is a
3-line textarea that drops down below the row, posts with `⌘↵`,
cancels with `esc`. Doesn't open the drawer.

Use case: a dispatcher reading a comment that just landed wants to
reply "got it" without the context switch of opening the drawer
to the timeline tab and finding the composer.

---

## 5. Command palette extensions

Today: `⌘K` opens a search + nav palette. Probably routes to /now,
/work, etc.

### Proposed: command palette as universal action surface

**Modes the palette should support:**
1. **Navigation** — `/now`, `/work`, `/money?tab=approvals`
2. **Entity jump** — type `WO-1043` or "leak" → list of matches
3. **Action** — type `assign carlos to WO-1043` → executes
4. **Create** — type `new WO bathroom leak at 247 Maple 2A` → opens
   a pre-filled create form
5. **Filter** — type `overdue blocked` → applies the right filters
   on /work

Reference: Linear's command palette. Operators learn the verb-noun
grammar fast.

### Palette as the keyboard escape hatch

Every action in the UI should be reachable from the palette. If
operators can't remember the keyboard map, they `⌘K` then type the
action they want. This is the failsafe.

---

## 6. Optimistic UI + undo

Today: every server action is awaited. The button disabled-spins
until the action returns. UI feels slow even when fast.

### Proposed

- **Optimistic by default** — clicking "Sign off" immediately
  fades the row out of the approvals queue. If the server call
  fails, the row snaps back with a toast.
- **Toast pattern** — every mutation shows a success toast with an
  **Undo** action. The toast lives ~5s. Pressing `⌘Z` is
  equivalent.
- **Server actions support undo** — at least for the dangerous
  ones (status change, decision, comment delete).

This is the single biggest perceived-speed win after keyboard
shortcuts. Linear and Superhuman both lean on it hard.

---

## 7. Persistent ops status (top bar)

Today: status line is page-scoped (/now only).

### Proposed: the status line lives in the top bar

The top bar carries:
```
[ STACK OS  |  42 open · 8 overdue · 4 blocked · 5 awaiting ]  [⌘K]  [+]  [🔔]
```

Always visible. Always clickable. Operators never lose the
operational anchor as they navigate.

The current /now page status line becomes a slightly larger,
more detailed version of the same data — the top bar is the
"glance," /now is the "stare."

---

## 8. The activity strip evolves into a coordination feed

Today: read-only tape of audit events, 12 visible.

### Proposed evolution

1. **Filter chips above the strip:** `All · Mine · Mentions · Ops`
   - `All` (default) — every event in the org
   - `Mine` — events on entities the operator owns
   - `Mentions` — events involving @mentions of the operator
   - `Ops` — exclude noise (cost_recorded, attachment_uploaded);
     keep status changes, assignments, approvals, blockers
2. **Hover row → inline actions:**
   - Reply (opens inline composer)
   - @mention a teammate
   - Snooze (hide for an hour)
3. **Scroll-to-load-more** — infinite-ish; keep loading older
   events as the operator scrolls.
4. **New-event highlight** — events that arrived since the
   operator's last visit pulse briefly when scrolled into view.

The strip should feel like *watching a coordination channel*. Not
a database query result.

---

## 9. Cross-entity hover-highlight (the "ops graph" surfacing)

This is the speculative, highest-design-leverage idea. Today
causality is structural to the data; this makes it interactive.

### Proposed

When the operator hovers an entity reference anywhere in the UI
(a row, a ref chip in the activity strip, a "WAITING ON SIGN-OFF"
link in the drawer):
- All other surfacings of related entities on screen subtly
  highlight (very faint background color, no animation).
- The entity's ref turns from gray to foreground.

Example: operator hovers `WO-1001` in the overdue lane on /now.
- The two AP- approvals in the needs lane glow faintly (related
  via the approvals targeting WO-1001).
- The Stark Plumbing row in the activity strip glows (Stark is
  assigned).
- The vendor's COI row (if visible) glows (Stark's insurance
  is what gates this WO).

The operator sees the *system of relationships* without having to
navigate.

**Why this matters:** every PM tool shows entities. The thing
that makes this an operational coordination OS is showing the
*connections* between entities. This interaction makes the graph
visible at the speed of thought.

**Risk:** noise. The highlights have to be SUBTLE — a 5%
background change, no motion. Otherwise it becomes a Christmas
tree.

**Reference:** Palantir Foundry's ontology view (which is
mouse-driven exploration of an entity graph) and Figma's
"hover shows linked frames" pattern.

---

## 10. Mobile interactions (out of scope for this pass, noted)

Mobile is partially built (bottom tab bar). Operators in the
field need:
- Quick status change without keyboard
- Voice-to-comment
- Camera-to-attachment
- Offline queuing

This is a separate pass. The keyboard model above is desktop.
Mobile gets touch gestures (swipe a row left = quick actions;
swipe right = snooze) but the rest of this doc assumes desktop.

---

## What we are explicitly NOT doing

- Drag-and-drop kanban as the primary work view. (The board view
  exists on /work; keep it as an option, not the default.)
- Trend charts / sparklines in the row tail. (Decoration.)
- Real-time presence indicators ("Sara is also viewing this").
  (Future, low priority.)
- AI suggestions ("we suggest assigning this to Carlos because
  …"). Possibly useful eventually; out of scope for ops
  ergonomics pass.

---

## Summary: the interaction stack ranked by leverage

1. **Keyboard model (j/k/o/c/s/x)** — biggest single perceived-
   speed change.
2. **Docked split drawer** — the cockpit becomes usable for
   sustained sessions.
3. **Optimistic UI + ⌘Z undo** — closes the "feels slow even
   though it's fast" gap.
4. **Inline row actions on hover** — kills the click-into-drawer
   friction for routine ops.
5. **Persistent status line in top bar** — the anchor follows the
   operator.
6. **Batch select + bulk ops** — Tuesday triage becomes
   tractable.
7. **Cross-entity hover-highlight** — the moat.
8. **Activity strip filtering + actions** — feed becomes
   coordination surface.
9. **Command palette as action surface** — escape hatch for
   power users.
10. **Inline status menu on row** — micro-op for daily routine.

Sequence in `implementation_priority_order.md`.
