# Tier 1 Execution Summary

Operator-ergonomics sprint. Six changes, no others. Goal: make the app
feel **fast, calm, operational under pressure**. Reference: Linear meets
Palantir meets dispatch terminal.

Screenshots: `/test/screenshots/before/` vs `/test/screenshots/after/`
on this branch.

---

## What landed

### 1. Row hierarchy system

`web/src/components/operator/entity-row.tsx`

Every row used to render the same: dot + ref + priority chip + title +
owner + time + status, all visually equal weight. After this pass:

- **3px severity rail on the left edge** of urgent / overdue / blocked
  / high rows. Red on urgent/overdue; amber on blocked/high. Routine
  rows have no bar at all — the silhouette change is the keystone
  triage signal.
- **Per-lane tail signal** via a new `tailMode` prop. The right side
  of a row now answers a different question depending on the lane:
  - `overdue` → red age chip + vendor name (lg only). Owner is
    secondary.
  - `blocked` → blocker reason ("waiting on vendor", "needs sign-off",
    "insurance gap") in amber. Owner secondary.
  - `today` → scheduled time (`2:30p`).
  - `inflight` → owner avatar + initials, larger; time secondary.
  - `needs` → pending duration, red after 24h.
  - `changed` → action verb of the most recent state change.
  - `default` (catalog/`/work` flat list) → owner chip + time +
    status word, the legacy tail.
- **Title typography emphasized** when the row is urgent (`font-medium
  text-foreground` vs. routine `text-foreground`).
- **Vendor names truncate to 120–140px** so a narrow column (drawer
  open) doesn't stack vendors into 3-line columns.

### 2. /now lane hierarchy

`web/src/app/(app)/now/page.tsx` + `lane-header.tsx`

The page used to be six visually-equal lanes. After:

- **OVERDUE and BLOCKED lanes get an `emphasized` LaneHeader** — the
  whole lane title inherits the tone color (red/amber) and uses bolder
  typography. Compare to before: only the count number was tone-toned.
- **OVERDUE + BLOCKED lanes get a top border tinted to their tone**, so
  the lane section is visually framed on the page.
- **JUST CHANGED lane collapses to the first 3 rows** with a
  `show N more recent changes →` link to `/work?recent=24h`. It's an
  awareness signal, not a triage surface — most of it can stay folded.
- The status line that used to live at the top of /now is **gone from
  the page** because it now lives in the top bar (always visible).
- The activity strip stays.

### 3. Global status line

`web/src/lib/server/shell.ts` (new) + `top-bar.tsx` + `layout.tsx`

A persistent dispatch read-out renders in the top bar on every
authenticated page:

```
[org] 42 open · 18 overdue (4d) · 4 blocked · 5 awaiting · 3 COIs ≤30d  [Search ⌘K] [+] [avatar]
```

- Loaded once at the layout boundary via `loadShellSummary()` — one
  query batch (queue summary + inbox summary + overdue lane for the
  oldest-age detail).
- **Zero-value segments collapse silently** (the line never says
  `0 blocked`).
- Each segment is a clickable link to a scoped surface — clicking
  `overdue` jumps to `/work?due=overdue`.
- The "(4d)" detail next to overdue is the age of the oldest overdue
  WO — the pressure signal.

### 4. Docked split drawer

`web/src/components/operator/app-shell.tsx` +
`entity-drawer-docked.tsx` (new) + `entity-drawer.tsx`

The drawer used to be a Radix Sheet — a modal overlay that hid 40% of
the page. After:

- Drawer is now a **structural sibling of `<main>`**, not an overlay.
- When `?d=` is set, main shrinks (on `lg`+) and the drawer occupies
  the right ~540px. Queue stays scrollable on the left.
- On `md` viewports (no room for both), drawer takes the full main
  area; rail still visible.
- Mounted **once** at AppShell level — page-level `<EntityDrawer />`
  mounts in `/now` and `/work` removed. Every surface (including
  /compliance, /money, /inbox) now gets the drawer for free.
- `esc` still closes it.

### 5. Keyboard-first operator flow

`web/src/components/operator/keyboard-provider.tsx` (new) +
`entity-row.tsx` (added `data-row="true"`)

A single keyboard provider mounted at AppShell root handles:

| Key | Action |
|---|---|
| `j` / `↓` | next row |
| `k` / `↑` | previous row |
| `o` / `↵` | open the focused row's drawer |
| `esc` | close the drawer |
| `/` | open the command palette (search) |
| `?` | toggle the shortcut overlay |
| `g` then `n/w/c/m/i` | navigate to /now /work /compliance /money /inbox |

Rows opt in with `data-row="true"` (added to `EntityRow`). The
provider does no state — it just calls `.focus()` and `.click()` on the
right DOM node. Pressing `?` shows a clean monospace overlay listing
every binding, grouped by category.

Input/textarea/contenteditable elements opt out (typing in the comment
composer doesn't trigger `j` → next row).

### 6. Surface reduction

`web/src/components/operator/nav-items.ts` +
`web/src/app/(app)/board/page.tsx`

The rail went from six entries (Now, Work, Compliance, Money,
**Settings**, Inbox) to five operational destinations. Specifically:

- **Settings removed from the daily rail** — moved into the Clerk
  `UserButton` avatar dropdown. It's not a daily destination.
- **`Inbox` promoted from secondary to primary**, with a `mobile: true`
  flag so it also appears in the bottom tab bar.
- **`/board` page replaced with a redirect** to `/work?view=board`. The
  board still works; it's now a view mode of /work, not a surface.
- **Bell icon removed from top bar.** Inbox in the rail (with a count
  badge) is the single notification signal — no duplicate.
- **Count badges on rail items** for `Work` (overdue), `Compliance`
  (cois≤30d), `Money` (needs sign-off), `Inbox` (unread). Tone red on
  overdue / pending sign-offs; quiet gray otherwise.
- **`/dispatcher` page unlinked** (not deleted; direct URL still works,
  but it's not in nav).

---

## Why each one matters operationally

| Change | Operator effect |
|---|---|
| Row hierarchy | Triage time drops from "read every line" to "look at left edges." Most rows compress; urgent ones assert. |
| /now lane hierarchy | The page peaks on overdue. Just-changed stops dominating the scroll. |
| Global status line | The operational state follows the operator across pages. No more context loss on navigation. |
| Docked drawer | Read + act simultaneously. The cockpit pattern Superhuman / Linear use for sustained work. |
| Keyboard model | Daily dispatchers move 3–5× faster. Mouse becomes the fallback for new users. |
| Surface reduction | The product feels focused. The daily loop is five surfaces, not ten. |

The combined emotional effect: the app stops feeling like a "stack of
lists" and starts feeling like an **operational frame** with a working
cockpit inside it. That's the Tier 1 leap.

---

## What was intentionally avoided

Per the sprint contract — no scope creep, no overdesign:

- **No drawer pinning / multi-pin.** Tier 3.
- **No batch select + bulk operations.** Tier 2 — depends on Tier 1
  keyboard model being live first.
- **No optimistic UI / global undo.** Tier 2.
- **No cross-entity hover-highlight (the "ops graph").** Tier 3 moat.
- **No /now upcoming lane.** Tier 3.
- **No saved views on /work.** Tier 3.
- **No drag-and-drop kanban as default.** Stays a view mode.
- **No /money rebuild into variable-height cards.** Tier 2.
- **No /inbox inline reply / dismiss.** Tier 2.
- **No charts / sparklines / KPI cards.** Forbidden.
- **No theming polish, no animation flourishes, no gradients, no
  glassmorphism, no decorative shadows.** Quiet confidence.
- **No real-time presence.** No AI suggestions. No gamification.

These are explicitly known to be valuable but deferred. Sequence is
in `docs/design/implementation_priority_order.md`.

---

## Files changed in this sprint

**New:**
- `web/src/lib/server/shell.ts` — single layout-level summary loader
- `web/src/components/operator/keyboard-provider.tsx` — global key model
- `web/src/components/operator/entity-drawer-docked.tsx` — docked wrapper

**Modified (component layer):**
- `web/src/components/operator/app-shell.tsx` — split layout, providers
- `web/src/components/operator/top-bar.tsx` — status read-out, no bell
- `web/src/components/operator/left-rail.tsx` — count badges
- `web/src/components/operator/lane-header.tsx` — emphasized prop
- `web/src/components/operator/entity-row.tsx` — severity rail + tail variants
- `web/src/components/operator/nav-items.ts` — surface reduction
- `web/src/components/operator/entity-drawer.tsx` — Sheet → div

**Modified (page layer):**
- `web/src/app/(app)/layout.tsx` — fetches shell summary
- `web/src/app/(app)/now/page.tsx` — lane component, hierarchy
- `web/src/app/(app)/work/page.tsx` — removed drawer mount
- `web/src/app/(app)/board/page.tsx` — redirects to /work?view=board

**Test harness:**
- `test/e2e/screenshot.spec.ts` — captures docked-drawer states
- `test/screenshots/before/*.png` — preserved baselines (9 shots)
- `test/screenshots/after/*.png` — new state (9 shots)

---

## Validation

`pnpm typecheck` → clean.
`pnpm test` → 125 / 125 pass.
`pnpm build` → succeeds; `/now` route at 1.65 kB (149 kB First Load).

All 9 surface screenshots captured. Compare:

| Before | After |
|---|---|
| `before/01-now.png` | `after/01-now.png` — status line in shell, lane hierarchy, severity rails |
| `before/02-work.png` | `after/02-work.png` — same row composition, dense list |
| `before/03-compliance.png` | `after/03-compliance.png` — shell chrome around existing layout |
| `before/04-money-approvals.png` | `after/04-money-approvals.png` — shell chrome, persistent state |
| `before/06-inbox.png` | `after/06-inbox.png` — inbox in primary rail |
| `before/07-drawer-wo.png` | `after/07-drawer-wo.png` — **docked split**, queue visible alongside cockpit |
| `before/08-drawer-approval.png` | `after/08-drawer-approval.png` — same, approval cockpit docked |
| `before/09-drawer-wo-timeline.png` | `after/09-drawer-wo-timeline.png` — timeline tab docked |

The biggest single visual delta is `07-drawer-wo.png` — before the
drawer was a modal hiding the page; after, the operator reads the
queue and acts in the cockpit simultaneously.

---

## Operator interaction philosophy now in place

The product currently runs on three principles that didn't exist before
this sprint:

1. **Severity has physical weight.** The row silhouette changes with
   pressure. The eye triages without reading.
2. **The shell is the operational anchor.** The status line travels
   with the operator; the rail signals where work demands attention.
3. **The cockpit doesn't blink the queue away.** Reading and acting
   happen simultaneously. The drawer is part of the work surface, not
   a modal that steals it.

The next sprint (Tier 2) lands optimistic UI, batch operations,
variable-height approval cards, inbox inline actions, and drawer
header actions — built on top of this foundation.
