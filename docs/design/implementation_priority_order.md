# Implementation Priority Order

The previous four docs lay out the full redesign space. This one
ranks it. Every entry includes: **what**, **why it matters**,
**rough effort**, **expected operator-feel delta**.

The bias: tier 1 picks are the few changes that produce the
biggest *"operator OS"* leap per unit of work. Tier 2 picks are
high-leverage but secondary. Tier 3 picks are nice. The Skip list
is what we should *not* build, despite obvious-looking value.

---

## Tier 1 — ship next (biggest "operator OS" leap)

These five changes, shipped together, would move the product
materially closer to the elite-operator-tool target.

### 1.1 Row hierarchy fix: left-edge priority bar + per-lane tail signal

**What:** rebuild row composition so that
- urgent/blocked rows get a 3px colored bar on the left edge of the
  whole row (Linear pattern)
- the right-side "tail" of each row carries ONE primary signal
  specific to the lane (not the uniform owner/time/status trio)

**Why it matters:** this is THE single change that fixes the
"everything weighs the same" problem the user called out. The
silhouette of a row changes based on severity. Operator triage time
drops from "read every line" to "look at left edges."

**Effort:** medium. Touches `entity-row.tsx`, requires new tail
variants, requires lane-aware row rendering. ~1-2 days.

**Operator-feel delta:** huge. This single move is probably the
biggest perceptual improvement in the entire design plan.

### 1.2 Keyboard model: `j/k/o/space/c/s/x` for row-level surfaces

**What:** implement the core keyboard map on /now, /work, /inbox
- j/k = next/prev row
- o or enter = open drawer
- space = peek drawer (preview, doesn't change URL)
- c = open comment composer on focused row
- s = open status menu on focused row
- x = toggle row selection
- esc = close drawer / clear selection
- ? = keyboard help overlay

**Why it matters:** every elite operator tool (Linear, Superhuman,
PagerDuty) wins this way. Mouse-only flow is a dealbreaker for
operators who live in the app.

**Effort:** medium. Requires a global keyboard provider, row-focus
state, and integration with the drawer router. Existing libs
(react-hotkeys-hook) make this tractable. ~2 days.

**Operator-feel delta:** very large. Operators who learn the map
will move 3-5x faster.

### 1.3 Docked split drawer (the cockpit lives next to the queue)

**What:** change drawer behavior so that on desktop, clicking a
row opens the drawer in a docked split (queue on left, drawer on
right). Closing returns to full-width. Modal mode available via
explicit "expand" action.

**Why it matters:** the drawer is the cockpit per principle 6, but
today it's a modal that hides the queue. Operators can't read
context and act simultaneously. Docked split eliminates that.

**Effort:** medium. The current drawer is a Radix Sheet — needs
re-engineering as a resizable side pane. Some layout work in
app-shell.tsx. ~2 days.

**Operator-feel delta:** large. Sustained drawer sessions become
viable.

### 1.4 Lane visual weight = f(severity) on /now

**What:**
- Overdue lane: larger row spacing (40px not 32px), bolder lane
  title, possibly faint red row background
- Just-changed lane: collapses by default to last 3 events
- Lane header: when count breaches threshold, the entire header
  (not just the count) tones red/amber

**Why it matters:** today every lane visually competes equally for
attention. The lane that needs attention should dominate.
Operators' eyes go to the right place automatically.

**Effort:** small. CSS + a `tone` prop expansion on `LaneHeader`.
~0.5 days.

**Operator-feel delta:** medium. Makes /now feel less "uniform
stack of lists."

### 1.5 Status line moves to top bar (persistent across pages)

**What:** the dispatch status line (`42 open · 8 overdue (oldest
9h) · ...`) becomes a top-bar element rendered on every authenticated
page. The /now-specific version stays as a slightly more
detailed local version.

**Why it matters:** principle 3 (coordination beats observation) +
the audit's "top bar wastes 50% of its width." The operational
anchor follows the operator. No matter which surface they're on,
the high-level state is visible.

**Effort:** small. New top bar component, query the queue summary
in a layout. Cache shared across pages via Next.js fetch dedup.
~1 day.

**Operator-feel delta:** large. The shell starts feeling like an
operational frame instead of generic SaaS chrome.

### Tier 1 estimated total: ~7-8 engineering days

---

## Tier 2 — ship after Tier 1 is live for a week

These are high-leverage but their value depends on Tier 1 being in.
(E.g., batch operations require keyboard model + selection states
to feel right.)

### 2.1 Optimistic UI + ⌘Z undo

**What:** every server action returns immediately optimistically.
On failure, snap back with a toast. Each successful mutation shows
a toast with an "Undo" action; ⌘Z is equivalent.

**Why it matters:** closes the perceived-speed gap. Real Tuesday
operators move fast and make small mistakes; undo turns mistakes
into footnotes.

**Effort:** medium. Requires per-action undo handlers
(transitionStatus, decideApproval, comment) and a global toast
state with action history. ~2 days.

### 2.2 Batch select + bulk operations

**What:** `x` toggles row selection (Tier 1 keyboard). When ≥1
selected, a bottom bar slides up: "5 selected · Assign · Status ·
Comment · Snooze · Cancel."

**Why it matters:** Tuesday morning triage of 8 new WOs becomes a
30-second sweep instead of 8 individual clicks.

**Effort:** medium. Selection state, batch action server endpoints,
the action bar UI. ~2 days.

### 2.3 Activity strip: filtering + scroll + hover actions

**What:**
- Filter chips above the strip: `All · Mine · Mentions · Ops`
- Scrollable to load older events (infinite-ish, not capped at 12)
- Hover row → reply / @mention / snooze inline icons
- New-since-last-visit events pulse briefly

**Why it matters:** the firehose becomes a triagable, actionable
coordination feed.

**Effort:** medium. Pagination, filter param on the audit query,
inline action UI. ~2 days.

### 2.4 Inbox: reply inline + dismiss + filters

**What:**
- Each comment notification gets a reply composer that drops in
  place
- Each row gets a dismiss `✓` button
- Filter chips: All · Mentions · Assignments · Approvals ·
  Compliance · System
- Snooze action per row

**Why it matters:** inbox becomes a coordination surface instead of
an archive. Operators actually use it daily.

**Effort:** medium. Reuses comment server action, adds dismiss +
snooze schema (or uses local read-state). ~2 days.

### 2.5 Drawer actions in header

**What:** the drawer header becomes the action toolbar.
- WO: `[assign ▾] [status: blocked ▾] [⋯]`
- Approval: `[Sign off] [Reject]`
- Inspection: `[Start walk]` / `[Review]`

**Why it matters:** today the action buttons are at the BOTTOM of
the Overview tab, requiring scroll. Header keeps them always
visible.

**Effort:** small. UI move + state machine integration is already
done. ~1 day.

### 2.6 Variable-height approval cards

**What:** approval cards expand/compress based on urgency:
- Tier 1 (urgent): full card + red left bar + consequence banner
- Tier 2 (standard): current 120px card
- Tier 3 (low): 32px row with icon-only [✓][✗]

**Why it matters:** /money stops feeling like a uniform list of
decisions and starts feeling like a triage queue.

**Effort:** small. Mostly CSS + a urgency classifier function.
~1 day.

### Tier 2 estimated total: ~10 engineering days

---

## Tier 3 — ship when fundamentals feel solid

Real value, but predicated on Tiers 1-2 being well-bedded.

### 3.1 Cross-entity hover-highlight (the "ops graph" surfacing)

**What:** hovering an entity ref anywhere subtly highlights all
related entities elsewhere on the page (related approvals, vendor
COI, sibling WOs).

**Why it matters:** this is the moat. The product becomes
*coordination-aware* in a way no PM tool is. But it's also fragile
— done wrong it's noise.

**Effort:** large. Requires a client-side graph index and careful
visual restraint. ~3-5 days for a credible v1.

### 3.2 Saved views on /work

**What:** name + bookmark filter combos. Sidebar dropdown lets the
operator switch between `My open · Triage queue · Blocked this
week · Vendor escalations`.

**Why it matters:** power users build views once and live in them.
Today every filter combo is a manual setup.

**Effort:** medium. Schema for views, UI for save/load/manage.
~2 days.

### 3.3 Persistent drawer pinning (multi-pin)

**What:** the operator can pin up to 3 drawers; pinned drawers
survive row navigation; clicking swaps focus between them.

**Why it matters:** comparison flows — "compare these 3 approvals
side-by-side" — become possible.

**Effort:** medium. URL state evolves from `?d=` (single) to `?d=,d=,d=`
or a pin-state array. ~2 days.

### 3.4 "Upcoming" lane on /now

**What:** above the activity strip, a lane showing the next 4 hours
of scheduled work, recurring spawns, expected SLA breaches.

**Why it matters:** the page gains the "what's about to happen"
dimension. Today it has only present + past.

**Effort:** small-to-medium. Loader for future-events. ~1 day.

### 3.5 Lane name tone-coloring

**What:** when a lane's tone is red/amber, the lane NAME (not just
the count) inherits that tone. Bolder typography too.

**Why it matters:** small-but-meaningful hierarchy boost on /now.

**Effort:** trivial. ~0.5 day.

### 3.6 Compliance: inline "Request renewal" action

**What:** per expiring/expired COI row, a `[Request new COI]`
button that fires a magic-link email to the vendor.

**Why it matters:** compliance becomes actionable, not just
observable.

**Effort:** medium. Email template + audit + vendor invite reuse.
~2 days.

### 3.7 "Mine" toggle on /work + grouped urgency bands

**What:**
- A single chip at the top: `All · Mine · Unassigned`
- Rows group under urgency bands within the flat list

**Why it matters:** /work becomes the operator's personal queue,
not just the universal catalog.

**Effort:** medium. ~2 days.

### Tier 3 estimated total: ~12-15 engineering days

---

## Skip / overkill

Things that look valuable but would hurt more than help:

### Drag-and-drop kanban as the default work view

The board already exists. Don't make it default. Drag-and-drop is
slow vs. keyboard for power users; nice for new-user onboarding;
but not the daily mode.

### Trend sparklines / charts on /now

Decoration. Operators don't act on "avg resolution time ↑ 8%
this week" at 10am Tuesday. Push this to a separate analytics
surface (or skip).

### AI-suggested assignments

Maybe later. Real risk: an AI suggestion that's wrong damages
trust. Build operator-trust first via good defaults, then add ML.

### Real-time presence indicators

"Sara is also viewing this WO." Looks cool. Marginal value.
Build later if at all.

### Full mobile gesture system (swipe to assign etc.)

Mobile is partially built. Field workers use it differently.
That's a separate design pass, not part of the operator-OS work.

### Renaming the product surfaces (/now → /pulse, /work → /queue)

Cosmetic. The current names are fine. Don't bikeshed.

### Comprehensive theming / dark mode polish

Some dark mode work has happened. Don't sink another sprint
into theming until the operator-feel fundamentals are right.

### Replacing shadcn primitives with custom UI

The existing shadcn/ui base is good. The hierarchy fixes are at
the *composition* layer, not the primitive layer. Don't rebuild
buttons.

### "Insights" / suggestions sidebar

"You have 3 vendors who haven't been assigned in 30 days." Maybe
useful, but it's a feature pitch, not a UX fix. Park.

---

## Sequenced plan (if I had to write a sprint plan)

**Sprint 1 (2 weeks):**
- 1.1 Row hierarchy fix + tail signal
- 1.2 Keyboard model
- 1.4 Lane visual weight
- 1.5 Status line in top bar

**Sprint 2 (2 weeks):**
- 1.3 Docked split drawer
- 2.5 Drawer actions in header
- 2.1 Optimistic UI + ⌘Z undo (partial)

**Sprint 3 (2 weeks):**
- 2.1 Optimistic UI (finish)
- 2.6 Variable-height approval cards
- 2.4 Inbox inline reply + dismiss

**Sprint 4 (2 weeks):**
- 2.2 Batch select + bulk operations
- 2.3 Activity strip filtering

**Sprint 5+ (open):**
- Tier 3 items, prioritized by operator feedback after walking
  the live product

---

## The single test before shipping each tier

After each tier, run the same dispatch-loop walkthrough:

> "Imagine you're an operations manager at a property company at
> 9:14am Tuesday. Your phone just got the night summary. Walk into
> the app and triage the next hour of your morning."

If after Tier 1, the operator can:
- See the most urgent thing in the first 5 seconds (row hierarchy)
- Move through it with the keyboard, drawer staying docked (1.2,
  1.3)
- Always know the system state from any page (1.5)

...we've shipped the right things.

If after Tier 2, they can:
- Process 8 morning triage items in 90 seconds (batch ops, undo)
- Reply to a comment in inbox without context-switching (2.4)
- See a decision's consequence as a banner, not a footnote (2.6)

...we've earned the "operator OS" framing.

Tier 3 is moat. Tier 1-2 is product.
