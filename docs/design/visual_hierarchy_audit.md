# Visual Hierarchy Audit

**Premise:** the single biggest reason Stack OS still emotionally reads
as "developer-coded" is that every row weighs the same as every other
row. An urgent overdue leak and a routine quarterly filter swap
visually render as siblings. The eye cannot triage without reading
every line of text.

This document walks each visual layer and rates where the hierarchy
fails. Anchor screenshots live in `/test/screenshots/` on this branch.

---

## Layer 1 — The row (32px line)

Reference: `test/screenshots/01-now.png`, `test/screenshots/02-work.png`

### Current row composition (in source order)

```
[urgency dot 8px] [ref 68px mono] [URG/HIGH chip 4 chars]
[title  + " — " subtitle]
[ml-auto: owner chip 20px circle] [time -3d] [status text md-only]
[stale chip if open + untouched 7d+]
```

### Critique

**1. The urgency dot does too much work.**
A single 8px colored dot is the only thing differentiating an urgent
overdue leak from a routine inspection. It pulses for `overdue` but
even that is a single 8px dot pulsing — peripheral vision misses it.

In Linear, urgent issues get a left-edge red bar that spans the entire
row height. The row's *silhouette* changes. The eye lands on it from
across the screen.

**2. The priority chip is barely a chip.**
`URG` in a 4-character bold uppercase chip with a tight red
background is OK, but it sits *inline* after the ref. By the time the
eye finds it, it's already past the "is this row urgent" decision.

In PagerDuty, priority is encoded into both background color and
position — high-priority incidents shift slightly, the row is wider,
or the title typography is heavier.

**3. The title and subtitle blend.**
Title is `text-foreground`, subtitle is `text-muted-foreground` with
a "—" separator. On a 1280px viewport this is legible but on a busy
list it reads as one long string. Two ideas:
- Subtitle on a second line (sacrifices density but improves scan)
- Subtitle in a smaller, monospace font on the same line (Palantir
  pattern — id-shaped text reads differently from prose)

**4. Owner chip / time / status text are all on the right and all
roughly the same weight.**
The right edge currently carries: owner (20px circle) + time chip
(11px mono) + lastActionText (10px uppercase tracking). All gray,
all small. This is the visual "tail" of every row — and on a queue
of 40 rows the eye reads the same tail 40 times.

The tail should *differ* row-to-row by what matters most:
- For an overdue WO: the **time** should pop (large, red), owner is
  secondary
- For an in-flight WO: the **owner** should pop (bigger avatar +
  initials), time is secondary
- For a new untriaged WO: a literal "needs triage" chip should pop;
  the time and owner are noise
- For a blocked WO: a "what's blocking" chip should pop ("waiting on
  approval", "waiting on COI"), time is secondary

This is the keystone hierarchy change. Today the tail is uniform; it
should be a *single most-important signal* per row.

**5. No left-edge "priority bar" treatment.**
Linear's signature: a 3px colored bar on the left of urgent/high
rows. Stack OS has nothing on the left except the urgency dot. The
"silhouette" of the row never changes.

**6. The stale chip is hidden on mobile (`md:inline`).**
A row that's been untouched 14d is stale on every viewport. Hiding
the signal on mobile is wrong.

### Recommended row redesign

```
[3px left bar — colored when priority ≥ high or status = blocked]
  [status icon — specific per status, not generic dot]
  [ref mono]
  [title — heavier weight on urgent rows]
    [subtitle — second line, smaller, monospace, gray]
  [ml-auto: ONE primary tail signal — context-dependent]
  [hover: quick-action overflow icons appear]
```

The "ONE primary tail signal" is the big change. See
`surface_by_surface_critique.md` § /now for what that resolves to per
lane.

---

## Layer 2 — Lane headers

Reference: `test/screenshots/01-now.png` (top portion)

### Current

```
NEEDS YOU  5  ⋯ oldest 8h
OVERDUE   12  ⋯ oldest 9h
BLOCKED    4
TODAY      2  ⋯ next 2:30p
IN-FLIGHT  6
JUST CHANGED 41
```

All lane headers use the same `text-[11px]` uppercase tracking-wider
muted-foreground typography. The count number is tone-colored (red /
amber / muted) — but the LANE NAME never is.

### Critique

**The 12 OVERDUE problem.** Reading the lane title "OVERDUE 12" you
get a number with a color, but the lane *name* doesn't sell the
severity. Compare: a dispatch center's "12 ACTIVE INCIDENTS" header
would be in red caps, larger, possibly with a small pulsing dot. The
lane *belongs* to the severity.

**Subhead is too tucked.** `oldest 14d` is the operational truth of
the lane — that one item buried in there is rotting. Today it's
right-aligned, small, gray. It should be next to the count, same
size, possibly tone-colored when the value crosses a threshold ("the
oldest item is 14d old" = red).

### Recommended

- Lane name gets tone-coloring on red/amber lanes (not just the
  count)
- Subhead moves left, gets bolder typography on threshold breach
- Inactive lanes (count = 0) collapse to a single thin line "ALL
  CLEAR · OVERDUE" so the operator can confirm a lane is genuinely
  empty without scrolling

---

## Layer 3 — Status line (top of /now)

Reference: `test/screenshots/01-now.png` (very top)

Current: `42 open · 8 overdue (oldest 9h) · 4 blocked · 5 awaiting · 3 COIs ≤30d`

Dense monospace, dot-separated, each segment clickable.

### Critique

**This is the best-functioning element on /now.** It's working. It
reads like a dispatch terminal header. Keep it.

**One small failure:** when a segment value is `0`, it still
renders. `0 blocked · 0 awaiting` is noise. The dispatcher doesn't
need to be told nothing is blocked — they need to be told what *is*
happening.

**One opportunity:** the status line could carry *trend* without
becoming a dashboard. A small unicode arrow or sparkmark indicating
direction would help: `8 overdue ↑ from 6 this morning`. This crosses
into dashboard territory; only do it for the 2-3 most operationally
important deltas.

### Recommended

- Zero-value segments collapse silently
- Optional `↑3` / `↓2` micro-deltas on overdue + awaiting only
- The status line considers becoming **persistent in the top bar**
  rather than per-page — see Layer 6 (shell).

---

## Layer 4 — Activity strip

Reference: `test/screenshots/01-now.png` (between status line + lanes)

```
-1h @DM      moved → in_progress     WO-1006
-1h @AR      assigned                WO-1003
-1h @AR      commented               WO-1001
-2h @SY      moved → blocked         WO-1001
-7h Maya P.  requested sign-off      WO-1001
```

### Critique

**Strong but quiet.** Monospace tape feed reads exactly like a
dispatcher's log. The actor handles (@AR / @SY) work.

**Three problems:**

1. **All events weigh the same.** A status change to "blocked" is
   operationally bigger than "filed an invoice." Today both render
   in muted gray. Some events deserve to be louder:
   - status_changed → blocked / cancelled (high)
   - approval_requested / approval_decided
   - assignment changes
   The "noise" actions (cost_recorded, attachment_uploaded) should
   stay quiet or be filtered out.

2. **No filtering.** A real Tuesday has 50+ events/hour. Six visible
   rows means most events scroll away in minutes. Operators should
   be able to filter to "mentions of me," "events on my assignments,"
   "high-severity only."

3. **No interaction beyond click-to-open.** The strip is a
   read-only firehose. Operators who watch coordination flow want to
   *act* on events — reply to a comment that just landed, escalate
   when a status changes to blocked. Hover-actions on each row
   (reply, mention, snooze) would convert this from a feed into a
   coordination surface.

### Recommended

- Event weight per action type — heavier typography on status →
  blocked, approval_decided, assignment changes
- Filter chips above the strip: `all · mine · mentions · ops`
- Hover row → inline action menu (open · reply · snooze)
- Scroll-to-load-more (today caps at 12; should be infinite-ish)

---

## Layer 5 — Card surfaces (drawer, money rows)

Reference: `test/screenshots/04-money-approvals.png`, `test/screenshots/08-drawer-approval.png`

### Money approval cards

Current card layout (each ~120px tall):
```
[dot] title · WO-ref · pending Xh    $amount
      WO consequence chip
      notes
      [Approve] [Reject]            holding [VENDOR]
```

**This is very good directionally.** The card carries: title,
WO-ref, pending duration, consequence (overdue 2d), amount, notes,
action, owner. All the operator needs.

**Failure:** every card is the SAME height regardless of urgency. A
2-day-pending $1450 invoice blocking an urgent overdue WO renders
the same physical size as a $275 budget overage 2h old.

The visual hierarchy should compress quiet rows and expand loud ones:
- Quiet approval (≤4h, ≤$500, underlying WO not overdue): 32px
  row, single line, no expansion
- Standard approval: current 120px card
- Loud approval (≥24h pending OR underlying WO overdue): card
  gets a left-edge red bar + slightly more padding + the consequence
  chip becomes a full-width banner

### Drawer overview

Reference: `test/screenshots/07-drawer-wo.png`

```
TITLE
LOCATION
STATUS | PRIORITY
DUE    | UPDATED
DESCRIPTION
WAITING ON SIGN-OFF
MOVE THIS [buttons]
```

**Pretty.** Probably too pretty. Compare a Bloomberg position
panel: every field is a single line with the value next to the
label. Stack OS's drawer wastes vertical space on labels above
values. The operator scanning for "what's the due date" hits more
chrome than data.

The right model is **two-column key-value pairs**, monospace
values, lightweight labels. Linear's properties panel is the
reference.

---

## Layer 6 — Shell

Reference: any screenshot — the top bar + left rail are constant.

### Top bar (44px)

```
[SEARCH ⌘K   .........]  [+]  [🔔 17]
```

Center-left: search bar takes 1/4 of viewport but is mostly empty
whitespace. Right: a `+` create button and a bell icon with unread
badge.

**Wasted space.** The top bar is the most persistent visual real
estate in the app. It carries: a search box (useful), a create
button (useful), a bell (useful), and ~50% empty space.

The empty space should carry **the status line** — the dispatch
read-out should never leave the operator's sight, regardless of
which surface they're on. Right now /now has the status line; /work
has nothing equivalent. The operator switches contexts and the
"what's the operational state" cue evaporates.

### Left rail (200px)

```
Now
Work
Compliance
Money
Settings
─ ─ ─
Inbox
```

Six items, all same weight, all same icon size, no counts, no
sections. This is the cleanest part of the shell — and the
weakest from an information-density perspective.

In Linear: nav items have unread counts next to them. In Slack:
unread channels render bold. In Stack OS: there is *no signal* from
the rail that "Inbox has 17 unread" except the bell badge in the
top bar.

Operators want their rail to tell them: "Hey, /money has
something demanding action — 5 sign-offs waiting, 1 overdue."

### Recommended

- Persist the status line in the top bar (or just below it) — it's
  the operational anchor; it shouldn't be page-scoped.
- Add count badges next to nav items: `Money 5` / `Inbox 17` /
  `Compliance 3` (only when > 0 and demanding action). Tone the
  badge red when SLA breach exists.
- Settings stays at the bottom (or moves into a profile dropdown
  from the top bar) — it's not a daily destination.

---

## Layer 7 — Typography

Today's type system:
- `text-sm` (14px) — body
- `text-[13px]` — row body
- `text-[11px]` — mono refs, time, tail
- `text-[10px]` — uppercase tracking labels
- `text-xl` font-mono — stat numbers

### Critique

**Too uniform across surfaces.** A drawer's title and a row's title
use roughly the same type. A status line value (xl mono) and a row
priority badge (10px) are at opposite ends of the scale but
nothing in between.

**No display tier.** When the operator needs to see "8 OVERDUE" as
a single number across the room, today it's just `text-xl
font-mono`. That's fine in the status line but there's no
larger-display tier for moments that deserve it.

### Recommended

- Add a `text-2xl` / `text-3xl` mono tier for **alert numbers** —
  used sparingly on /now when an overdue count crosses a threshold.
- Body text stays 13–14px (good).
- Row titles get a `font-medium` (currently default) — and on
  urgent rows, `font-semibold`.
- Mono refs stay 11px tabular-nums (good — don't change).

---

## Layer 8 — Color & tone

Today's palette is sparse and intentional:
- `urgency-overdue` (red)
- `urgency-blocked` (amber)
- `urgency-done` (green-gray)
- `muted` / `foreground` / `background`

### Critique

**Three colors is too few for a coordination OS.** Today the system
encodes only severity. It does NOT encode:
- Causality (which entities are linked to which)
- Ownership (whose work this is)
- System actor (vendor vs. staff vs. system)

A dispatch terminal might use:
- Severity colors (red/amber/green)
- A "context" hue per surface (subtle wash so the operator knows
  they're on /now vs. /compliance without reading the page title)
- An actor color per teammate (avatar circle color = consistent
  for that person)

The fourth and fifth principles ("calm by default", "operator
language") cap how loud the color system can get. But going from
3 to ~5 distinct semantic colors won't make it loud — it'll make
it more *expressive*.

### Recommended

- Add an actor color seed: hash the user_id → consistent muted
  background for that user's avatar chip. Operators learn to
  associate the color with the person at peripheral-vision
  distance.
- Consider a subtle surface tint per nav section: /money has a
  very faint warm tint, /compliance has a faint cool tint. This
  isn't decoration — it's an orientation cue when operators
  context-switch fast.
- Keep severity restraint. The temptation will be to add yellow
  and purple "for variety." Resist it. Three severity levels is
  enough.

---

## Summary: the 6 highest-leverage hierarchy fixes

In order of "biggest emotional change per unit of work":

1. **Row tail per-lane semantic** — replace uniform owner/time/status
   tail with ONE most-important signal per row, contextual to lane.
   (Today: noise. After: signal.)
2. **Left-edge priority bar on urgent/blocked rows** — the
   silhouette change. (Today: row looks identical. After: the eye
   lands.)
3. **Lane name tone coloring** — not just the count, the whole lane
   header reflects the severity.
4. **Status line in the top bar, persistent across pages** — the
   anchor follows the operator.
5. **Activity strip filtering + event weight** — the firehose becomes
   triagable.
6. **Approval card height = function of pressure** — quiet decisions
   compress, loud decisions expand.

Tier-1 implementation order is in `implementation_priority_order.md`.
