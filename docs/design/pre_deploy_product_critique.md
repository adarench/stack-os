# Pre-Deploy Product Critique

**Frame:** the architecture is solid, the systems are right, the
interactions are getting good. The product can still fail at the
**taste** layer. This document calls each piece of UI as one of:

- **Elite** — would not look out of place at Linear, Palantir, Ramp.
- **Solid** — operationally correct; nothing to fix.
- **Startup-y** — competent but generic; reads as "any vertical SaaS."
- **Under-designed** — needs more density / signal / hierarchy.
- **Over-engineered** — too many states, too much chrome, taste leakage.

**Bias:** brutal. The system has earned the right to be evaluated as
elite operator tooling, not as MVP demo. Items I would protect from
previous passes get cut here if they don't hold up.

---

## Calls

### Top bar status line — **elite**

`42 open · 18 overdue (4d) · 4 blocked · 5 awaiting · 3 COIs ≤30d` reads
like a dispatch terminal header. Monospace, tone-coded, dot-separated.
The "(4d)" oldest-overdue detail is the kind of small operational
gravity that distinguishes operator tools from dashboards.

Caveat: the top bar's left third is empty when there's only one org
(Clerk renders nothing). Reads as "unfinished" until populated.

### Left rail with badges — **elite**

`Now · Work 18 · Compliance 3 · Money 5 · Inbox` — count badges with
red tone on overdue/pending. This is what Linear does, what Github
mobile does, what Slack does. The rail is now operational, not
generic. Settings out of the rail is a discipline call: correct.

### Docked drawer — **elite**

The cockpit pattern works. `07-drawer-wo.png` shows queue + entity
side-by-side, exactly Superhuman split-pane. The drawer feels like
part of the work surface, not a modal pop-up.

Caveat: the drawer-main border is a hairline; the boundary could be
slightly more elevated (subtle bg tint or shadow) so the operator's
eye registers "this is a different surface."

### Approval drawer — **elite, possibly best in class**

`after/08-drawer-approval.png` is the strongest single surface in the
product. AP ref + reason + amount + pending + notes + WILL UNBLOCK
linked-WO card + Sign-off/Reject. Every element earns its place. The
WILL UNBLOCK card is the cross-entity causality made visible —
operators reading this know exactly what their decision unlocks.

This is the surface to point to when arguing "Stack OS isn't a PM
tool, it's a coordination OS." Don't change it.

### /now lane hierarchy — **solid**

OVERDUE dominates. The red-bold lane title + tinted top border + red
count + the column of severity-railed urgent rows = operator triage
in 1 second.

Caveat: the NEEDS YOU lane gets `tone=red` because count ≥ 5 but the
title isn't emphasized — the `emphasized` flag is hardcoded to
overdue/blocked only. **Visible bug.** Fix: drive `emphasized` from
the tone, not from the laneKey.

### Per-lane row tails — **solid**

Overdue rows show `Stark Plumbing Co -5d` — owner + red age. Needs
rows show pending duration. The right-side composition finally
varies. This is the "one primary signal" principle landing.

Caveat: vendor names on overdue rows are `lg:inline` only — on
narrow viewports they vanish. Mobile operators miss the owner entirely.

### Activity strip — **startup-y** (data problem)

The component is right. The events are right shape. But every row
reads `-3d @MP moved → in_progress WO-1006`. **Three things go wrong
visually:**

1. All timestamps are `-3d` because the seeded data is stale.
2. `moved → in_progress` mixes a humanized verb with a raw enum
   value.
3. The reader can't tell which events are seconds-old (live) vs.
   days-old (history).

The fix is data + a tiny rendering tweak. With fresh data and verb
humanization, this becomes elite. Without, it reads as "developer
demo."

### /work — **under-designed**

`after/02-work.png` is the weakest of the five operational surfaces.
42 rows of nearly identical 32px composition with no urgency banding.
Severity rails are barely visible (the colors may be too low-saturation
or covered by the row background).

The page reads as a CRUD list because it IS a CRUD list — the design
audit recommended urgency banding (Overdue / Blocked / In-flight /
Today / Backlog as inline section headers within the flat list) but
that was a deliberate Tier 1 deferral.

Net: /work hasn't materially evolved from before. **Highest-leverage
Tier 2 target.**

### Filter chip bar — **solid**

The three-group chip bar (TYPE / STATUS / DUE) with vertical dividers
is right. Active chips have dark backgrounds; inactive are light.
Reads as a real filter UI, not a hamburger menu.

### /compliance — **mixed (elite + over-engineered)**

CANNOT DISPATCH panel: **elite**. Loud red border, structured rows,
"BLOCKS N WOS" chip per vendor, "no insurance on file" tail. The
operational consequence is visible. This is the pattern.

Three stat tiles (Active 5 / Expiring soon 2 / Expired 1):
**over-engineered**. The tab badge already shows `VENDOR COIS 8`.
The tiles repeat that without adding info. **Delete.** They are
the dashboard reflex.

COI rows: **startup-y**. The rows lack severity rails. An expired
Greenleaf row with 2 blocked WOs reads only marginally louder than
an active Stark Plumbing row. The visual hierarchy from /now didn't
carry over to /compliance.

### /money approvals — **solid, with one taste leak**

Cards work. Operational chips (WO BLOCKED, OVERDUE 5D) work. Approve
/ Reject inline work. Pending duration in red works.

The taste leak: every card is the same physical size. A $1450 5-day
urgent decision and a $275 budget overage look identical. The design
audit recommended variable-height cards (tier 1 full / tier 2 standard
/ tier 3 32px row). Deferred to Tier 2. Until then, /money's
hierarchy is purely textual.

### /money invoices — **under-designed**

`after/05-money-invoices.png` is mostly empty whitespace. 8 invoice
rows. No vendor names. No WO refs. No grouping by vendor. No "submitted
by." The operator needs to click each one to learn anything.

This is the surface that risks /money drifting into "accounting clone."
It needs the same treatment as approvals (operator context, not just
db state).

### /money export — **over-engineered**

A full tab for a single button. Wasted real estate. Fold into a footer
action or replace with a "Recent decisions" feed.

### /inbox — **solid, with data problem**

Threading works. Operator-language subjects work. Target ref chips
work.

Taste leaks: notification type chips (`WO CREATED`, `APPROVAL REQUESTED`,
`COMMENT EXTERNAL`) read as enum names. Should map to operator
phrases. And like the activity strip, timestamps are all `-3d` /
`-4d` — staleness undercuts the "live coordination" feeling.

### Comment composer in drawer — **elite**

The Timeline tab's composer is exactly right. Textarea + `INTERNAL`
toggle + `⌘↵ to post` hint + `Post` button. The two visibility tones
(internal-card-muted vs. with-vendor-amber-tinted) make conversation
state visible at a glance.

Caveat: the `INTERNAL` toggle is a tiny mono caps text-button. Reads
"developer affordance," not "switch." A small icon-switch widget
would be more operator-readable.

### Keyboard model — **solid, undocumented**

`j/k/o/esc//?/g+n` all work. Tested briefly via Playwright (focus
moves on `j`, drawer opens on `o`). But there is **no on-screen hint**
that any of this exists. The drawer footer says "Press esc to close"
— that's it. A new operator never discovers `?` or `j/k`.

Either add a tiny persistent footer hint ("press ? for shortcuts") or
explicitly trade discoverability for cleanliness. The current default
hides the feature.

### Empty states — **untested**

Most of these screenshots show populated state. The empty states
(no overdue, no approvals, no notifications) aren't visible here.
Worth a follow-up audit on those before deploy.

---

## What's elite, ranked

1. Approval drawer (`08-drawer-approval.png`) — the moat made visible.
2. Top bar status line — the dispatch anchor.
3. Docked drawer cockpit — sustained-work mode.
4. /now OVERDUE lane hierarchy — peripheral triage.
5. Left rail with operational badges — the rail finally signals.
6. Comment composer with visibility toggle — operator coordination.
7. CANNOT DISPATCH compliance panel — consequence propagation.

These are the surfaces to point to when explaining "this is operator
software, not a PM tool."

---

## What still feels startup-y, ranked

1. **Stale timestamps everywhere.** The single largest "this is not
   live" affect. Re-seed before deploy.
2. **/work is a 42-row spreadsheet.** Highest-leverage Tier 2 target.
3. **/money invoices** is empty whitespace + db-state rows.
4. **/compliance stat tiles** are dashboard decoration.
5. **Three red signals on urgent rows** (bar + dot + URG chip) feel
   over-eager.

---

## What's over-engineered

1. **/compliance stat tiles** — repeat data, no action.
2. **/money export tab** — one button.
3. **Drawer TITLE field** in OVERVIEW (redundant with header).
4. **Empty drawer tabs (COSTS 0, FILES 0)** when count is zero.

---

## What's under-designed

1. **/work urgency banding** — flat list reads as spreadsheet.
2. **/money invoice rows** — no vendor/WO/actor context.
3. **Top bar left side** — empty when single org.
4. **Severity rails on /work** — too subtle to register at glance.
5. **Discoverability of keyboard shortcuts** — no on-screen hint.
6. **/now activity strip event weight** — every event same weight;
   should differentiate noise (cost_recorded) from coordination
   (status changes, assignments, approvals).

---

## What should tighten BEFORE deploy

**Hard blockers (1 hour total):**

1. Re-seed prod DB so timestamps anchor to now. The single largest
   intent-to-render gap.
2. Fix NEEDS YOU lane emphasis bug (`emphasized` should be tone-based).
3. Delete /compliance stat tiles.
4. Hide empty drawer tabs (COSTS 0, FILES 0).
5. Humanize activity strip diff values (`in_progress` → `in progress`).

**Strong recommends (additional 1-2 hours):**

6. Add a tiny brand mark or org label to the top bar left third.
7. Add a subtle `border-l` shadow or bg tint on the docked drawer
   so the column boundary registers more clearly.
8. Verify severity rails actually render on /work (CSS audit).
9. Add a persistent footer hint or status-bar text indicating `?`
   shows shortcuts.
10. Humanize notification type chips in inbox (`WO_ASSIGNED` →
    `assigned`, `APPROVAL_REQUESTED` → `needs sign-off`).

**Deferred to Tier 2 (correctly, per priority doc):**

- /work urgency banding
- Variable-height approval cards
- Inbox filter chips
- Optimistic UI + undo
- Batch operations

---

## Recommended deploy posture

**Don't deploy as-is.** The architecture is correct but the rendered
experience under-delivers because of:

- Stale demo data (read-as-dead)
- One visible bug (NEEDS YOU emphasis)
- Three over-engineered noise sources (compliance tiles, drawer
  empty tabs, drawer TITLE redundancy)

These are an hour of work. Ship after, not before. Without these
fixes, an operator walking the deployed product would experience
"directional improvement" rather than "this is fast." With them,
the product genuinely reads as elite operator tooling for the first
time.

The Tier 2 sprint (batch ops, /work banding, variable cards,
optimistic UI) is the next step. But Tier 1 needs to land cleanly
first.
