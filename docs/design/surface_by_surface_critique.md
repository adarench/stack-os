# Surface-by-Surface Critique

For each of seven surfaces:
1. **Current state** (anchored to screenshots in `/test/screenshots/`)
2. **Problems** — visual, interactional, operational
3. **Why each problem matters** in dispatch terms
4. **Redesign direction** — concrete moves
5. **Elite references** — what to steal from

Order goes from most-used (/now) to least-used (shell).

---

## /now — the dispatcher's home

Anchor: `test/screenshots/01-now.png`

### Current state
- Top bar (shared chrome)
- Header: `NOW` + LiveIndicator
- Status line: `42 open · 8 overdue (oldest 9h) · 4 blocked · 5 awaiting · 3 COIs ≤30d`
- Activity strip: 6 visible rows of mono tape
- Six lanes (Needs you, Overdue, Blocked, Today, In-flight, Just changed), all collapsible
- Lane rows: uniform 32px height

### Problems

**P1. The page is just a stack of lists.** The top of /now (status
line + activity strip) is dense and operationally rich. The bottom
(six lanes of rows) is a flat scroll. Operators reading the page
top-to-bottom experience operational density → uniform list quickly.
The page peaks early.

**P2. Lanes don't compete for attention.** OVERDUE 12 and JUST
CHANGED 41 visually weigh the same. The most operationally severe
lane should *dominate* the page; less severe lanes should be
collapsed or thinner.

**P3. The activity strip is too small.** 6 rows fixed-height. On a
moderately busy Tuesday, events scroll off in 15 minutes. Operators
who look away can't catch up without leaving /now.

**P4. There's no "what's next" surface.** The dispatcher can see
what's happening *now* (lanes) and what *happened* (activity strip).
They cannot see what's *about to happen*: the next inspection at
2:30p, the recurring task spawn at 9am tomorrow, the SLA breach at
11am.

**P5. No batch operations.** A dispatcher triaging 8 new WOs each
morning clicks each one to open the drawer to assign. Should be:
select all → assign to Stark → done.

**P6. The "All clear" empty state is too celebratory** still has
"Watching" tone, but the dispatch terminal analogue would be:
quiet, monospace, a count of active sensors. Less "you did it!",
more "system nominal."

### Why these matter

A dispatcher loads /now first thing in the morning. They need:
1. **Triage in <30 seconds** — what's on fire, what can wait. (P2)
2. **Catch up on overnight** — what happened, what's new. (P3)
3. **Plan the day** — what's coming up, what spawns will fire. (P4)
4. **Act fast** — assign 8 morning triage items in 2 minutes. (P5)

Currently /now does (1) reasonably well, (2) marginally, fails (3)
entirely, and (4) is painful.

### Redesign direction

**Move 1: Lane visual weight = f(severity).**
- Overdue lane gets larger row spacing, bolder lane title, possibly
  a faint red row background.
- "Just changed" lane collapses by default to a strip
  showing the most recent 3 events; expand on click. It's not a
  triage surface; it's an awareness surface.
- "Needs you" stays loud but with the row-tail signal being the
  pending duration (not the owner — operators acting on approvals
  don't need the WO owner first).

**Move 2: Add an "upcoming" lane above the activity strip.**
- The next 4 hours of scheduled work, recurring spawns, expected SLA
  breaches.
- Format: time, ref, description. Single line per item.
- This is the "what's about to happen" surface.
- Time-based, not status-based. Different mental model from the
  rest of /now (which is status partitions).

**Move 3: Activity strip grows + filters.**
- 20+ rows visible (not 6)
- Top filter: `All · Mine · Mentions · Ops` (see interaction doc)
- Hover row → reply / @mention / snooze
- New-since-last-visit events pulse briefly

**Move 4: Row-tail per lane.**
- Overdue lane: tail = age, in red, bold
- Today lane: tail = scheduled time (`2:30p`)
- Blocked lane: tail = blocker reason (`waiting on approval`,
  `waiting on COI`, `waiting on tenant`)
- In-flight lane: tail = owner avatar + initials, larger than today's
  20px chip
- Needs-you lane: tail = pending duration, red after 24h
- Just-changed lane: tail = the action verb (`@AR moved → in
  progress`)

**Move 5: Batch operations.**
- `x` toggles row selection
- Selection bar at bottom with `Assign · Status · Comment · Snooze`

**Move 6: Empty state = system nominal.**
- Replace celebratory copy with monospace dispatch-terminal calm:
  `Lanes clear · 42 entities monitored · last event 14m ago`

### Elite references
- **Linear inbox** — lane composition, severity weights, keyboard
- **PagerDuty incident dashboard** — severity-weighted layout
- **Datadog log viewer** — activity strip as scrollable + filterable
  feed
- **Air-traffic control radar screen** — "what's coming next" overlay

---

## /work — the unified browser

Anchor: `test/screenshots/02-work.png`

### Current state
- Filter chip bar (inline with item count)
- Flat list of all open work, sorted by urgency then updated_at
- ViewModeToggle (list vs. board)
- Same uniform row composition as /now

### Problems

**P1. It's a flat list of 40+ items.** No grouping, no separation by
urgency, no "above the fold" focus. The operator scrolls. Compare
to Linear's My Issues view, which groups by priority bands and
collapses lower bands.

**P2. Filters are right but UI is bare.** Three chip groups (type,
status, due) are good. But there's no notion of *saved views*. The
operator who filters to "wo + blocked + this week" every morning has
to click 3 chips every time.

**P3. The "what is /work for" is ambiguous.** It overlaps with /now
significantly. /now shows the same overdue + blocked + in-flight
items. So why two surfaces? Today the answer is "/now is curated
lanes; /work is the full catalog with filters." That's defensible
but unclear to the operator from the UI.

**P4. No way to see one's own work specifically.** No "Mine" toggle
in the top of /work. Operators who want their own queue have to
filter manually.

**P5. Board view exists but is undiscovered.** ViewModeToggle is in
the corner of the header. Operators won't find it. Also: when is
the board view operationally useful? Probably for triage of unassigned
work. Currently it's just a kanban for kanban's sake.

### Why these matter

/work is the operational catalog. It's where the dispatcher does
deep work — sweeping through items, finding stale things, assigning,
batching. It should *feel* like Excel meets Linear: dense, filterable,
keyboard-navigable, batch-friendly.

### Redesign direction

**Move 1: Group rows by urgency band.**
- Overdue items at top with a small banner header (`OVERDUE 8`)
- Blocked next (`BLOCKED 4`)
- In-flight (`IN FLIGHT 6`)
- Today scheduled
- Upcoming
- Backlog (collapsed by default)
This mirrors /now's lanes but is a SINGLE LIST with internal
section headers. Operator gets the structure without the
multi-list mental load.

**Move 2: Saved views in URL + sidebar.**
- The current URL state already encodes filters. Add a "Save view"
  action that names + bookmarks the current filter combo.
- A dropdown in the page header lets the operator switch between
  saved views: `My open · Triage queue · Blocked this week ·
  Vendor escalations`.

**Move 3: "Mine" toggle prominent in the top of /work.**
- Single chip at the top: `[ All · Mine · Unassigned ]`
- "Mine" filters to items where assignee = current user.
- "Unassigned" filters to items with no active assignment.

**Move 4: Board view becomes "Triage" view.**
- Rename from "List · Board" to "List · Triage."
- The triage view is a 3-column board: `New · Triaged · Assigned`.
- The dispatcher's morning workflow: drag new items into triaged
  (read + categorize), then into assigned (pick a vendor).
- This makes board view operationally specific instead of generic.

**Move 5: Batch operations** (same as /now).

**Move 6: Density toggle.**
- A compact view (24px rows, one-line, no subtitle) for power users
- A comfortable view (current 32px) for new users
- Persisted per user

### Elite references
- **Linear My Issues** — grouping, density, keyboard
- **Github issue list** — filter persistence, saved views
- **Airtable views** — saved view dropdown UX

---

## /compliance — the consequence surface

Anchor: `test/screenshots/03-compliance.png`

### Current state
- Red "CANNOT DISPATCH" violations panel at top with `BLOCKS N WOs`
  chips
- Tabs: Vendor COIs / Tenant insurance
- 3-stat summary (Active / Expiring / Expired)
- Flat list of policy rows with expiry chips

### Problems

**P1. This is the strongest current surface.** The consequence
linking ("blocks 2 WOs") is exactly the principle 4 (causality is
the product) made visible. Don't change the spirit.

**P2. The 3-stat summary tiles are weak.** They sit between the
violations panel and the policy list, taking ~80px of vertical
space, and they're just count repeats. The violations panel
already encodes "3 active violations," and the policy list shows
expiring/expired rows. The tiles are redundant decoration.

**P3. "Tenant insurance" terminology is database-ish.** Real
operators say "renter insurance" or just "tenant policies." Same
for "Vendor COIs" — operators say "vendor insurance" or "their
insurance certificate."

**P4. No timeline view.** The dispatcher wants to see "what's
expiring in the next 30 days, sorted by expiry." Today that's
implicit in the sort order but no clear "wall calendar of expiry
events."

**P5. No "renew" action.** Insurance is the canonical operational
ask: "vendor, send us your new certificate." Today the operator
clicks into a vendor's profile to send a request. Should be
inline on the row: `[Request new COI]`.

### Why these matter

Compliance is the operator's leverage over vendors. The vendor's
ability to get work is gated by their insurance state — that's a
real operational lever. The product should make that lever obvious
and easy to pull.

### Redesign direction

**Move 1: Drop the 3-stat tiles.**
- Already implied by the violations panel + the list. Just delete.

**Move 2: Inline "Request renewal" action per expiring/expired row.**
- Button or icon that sends a magic-link request to the vendor's
  contact email.
- Audit-logs the request, sets a follow-up reminder.

**Move 3: Rename tabs.**
- "Vendor COIs" → "Vendor insurance"
- "Tenant insurance" → "Renter policies"
- (Internal column names stay the same; just the labels change.)

**Move 4: Add a "Calendar" view toggle.**
- Same data, but timeline: x-axis = next 90 days, dots per expiry.
- Operators see clusters of upcoming work.
- Optional — could be a Tier 2/3 idea.

**Move 5: Expand violations panel into a "Cannot dispatch" workspace.**
- The panel is a single section. Click a violation → drawer opens
  showing the vendor + the 3 WOs that would be assigned to them + a
  one-click "Send renewal request" button.
- The drawer becomes the resolution flow.

### Elite references
- **Stripe Radar** — risk → consequence → action loop
- **Datadog SLOs** — burn-rate visualizations as expiry analogue
- **Notion's database calendar view** — for the timeline idea

---

## /money — operational financial coordination

Anchor: `test/screenshots/04-money-approvals.png`

### Current state
- Tabs: Approvals · Invoices · Export
- Approvals tab: card list, each card ~120px with reason, ref,
  pending Xh, $amount, notes, [Approve][Reject], holding owner
- Invoices tab: flat row list
- Export tab: a single download button

### Problems

**P1. The page is at risk of drifting into "accounting module."**
The user flagged this directly. Right now Money has three tabs:
Approvals (operational), Invoices (closer to AP/AR), Export
(reporting). If we keep adding to Invoices/Export, the surface
becomes ERP. We must lean Approvals harder.

**P2. Approval cards are good but uniform.** As noted in the
hierarchy audit, every card is 120px regardless of urgency. A 2-day-
pending decision blocking an urgent overdue WO should *physically
loom larger* than a $275 budget overage.

**P3. The "consequence chip" is the secret weapon, but underplayed.**
"WO BLOCKED" / "OVERDUE 2D" appears in small uppercase mono. It
should be a banner across the bottom of the card on the loudest
cards.

**P4. Export tab is a single button.** Wasted tab.

**P5. No "all-time activity" feed for the money surface.** When
did Maya approve the last $5k decision? When was a vendor's invoice
disputed? Today: invisible. Should be: a recent-decisions feed at
the top.

### Why these matter

Money is where the operator makes high-leverage decisions. The
average operator may sign off on 5 decisions a day, but each one
unblocks (or fails to unblock) downstream work. The page should
maximize *decision speed* and *decision context*. Every second
saved here compounds.

### Redesign direction

**Move 1: Variable card height.**
- Tier 1 (urgent: overdue WO underlying, ≥$1k, ≥24h pending): full
  card with a red left bar, consequence banner.
- Tier 2 (standard): current card (without left bar).
- Tier 3 (low: <$500, <8h, underlying WO not stressed): 32px row
  with `[✓][✗]` icon buttons, no notes shown.

**Move 2: Replace the Export tab with a "Recent decisions" feed.**
- The last 20 approvals decided (approved + rejected) with actor,
  WO ref, outcome, time.
- Operators can scan "who approved what when" without opening any
  drawer.
- Optional export button at the bottom (the existing export becomes
  a small footer action).

**Move 3: Consequence as a full-width banner on Tier 1 cards.**
- Instead of inline uppercase "WO BLOCKED · OVERDUE 2D," make it a
  prominent strip:
  `▸ Approving this unblocks WO-1001 (urgent · overdue 2d · Stark Plumbing on-site)`
- The operator reads ONE line and decides.

**Move 4: Group invoices by vendor.**
- Today invoices are a flat list. Operators thinking about money
  think "what's outstanding to Stark, what to Volt." Group by
  vendor with collapsible sections.
- Each vendor header shows: name, total outstanding, oldest pending.

**Move 5: Skip everything else.**
- No charts, no monthly view, no AR aging report. Those exist in
  AppFolio. We're the operational layer, not the GL.

### Elite references
- **Ramp request queue** — card-based decision surface with
  context-loaded consequence
- **Brex spend management** — actor + amount + reason + decide
- **PagerDuty escalation flow** — decision-with-downstream-effect

---

## /inbox — the coordination archive

Anchor: `test/screenshots/06-inbox.png`

### Current state
- Flat list of notifications, soft-threaded by entity ref
- Each row: dot · subject · ref · kind · time · body line
- Header: "17 new" badge, "20 TOTAL"

### Problems

**P1. Today this is the strongest surface visually after /now.**
The threading is working; the language is operator-y ("New WO:
Bedroom outlet not working," "WO-1003 assigned to Quicklock"); the
density is right.

**P2. But it's still a notification archive, not a coordination
surface.** Every row is read-only. No way to:
- Reply to the comment that triggered the notification
- @mention someone
- Mark as resolved
- Bulk dismiss

**P3. No filtering.** "Show me unread mentions only" — not
possible. On a busy week the operator has 200 notifications.

**P4. Subject + body wastes space.** "Stark commented on WO-1001"
+ "On-site. Confirmed source — supply line behind tub." The
subject is redundant when the body shows it. Could be one line:
`@Stark on WO-1001 · "On-site. Confirmed source…"`

**P5. The bell icon in the top bar is the only way to know there
are unread notifications.** Nav should also signal. (Already noted
in shell critique.)

### Why these matter

Inbox is where ops coordination flows. If the inbox is just a
read-only feed, operators stop checking it. If it becomes a
coordination surface (reply, action, dismiss), it becomes part of
the daily loop.

### Redesign direction

**Move 1: Reply inline.**
- Click a comment notification → composer drops down below the row.
- Posts a reply on the same entity, same visibility.

**Move 2: Mark as actioned.**
- Each row gets a `✓` icon that dismisses it. Bulk select + dismiss
  for sweep.
- The unread count shrinks as the operator works through the list.

**Move 3: Filter chips at top.**
- `All · Mentions · Assignments · Approvals · Compliance · System`
- Same chip language as the activity strip filters on /now.

**Move 4: Subject becomes a single dense line.**
- Format: `@actor verb-phrase + entity-ref · "first 80 chars of body"`
- Example: `@Stark commented on WO-1001 · "On-site. Confirmed source — supply line behind tub."`
- Removes the redundant subject line entirely.

**Move 5: Add "Snooze."**
- Snooze a notification for an hour / a day / until the related
  entity changes state.
- Snoozed notifications return as unread when the snooze fires.

### Elite references
- **Superhuman inbox** — split list with reading pane, keyboard,
  reply-in-place
- **Linear inbox** — type-filtered threading, mark-as-read patterns
- **Slack threads** — the model for in-place reply

---

## Drawer — the cockpit

Anchor: `test/screenshots/07-drawer-wo.png`, `08-drawer-approval.png`,
`09-drawer-wo-timeline.png`

### Current state
- Right-side modal sheet, ~540px wide, blocks the page
- WO drawer: Overview / Timeline / Costs / Files tabs
- Approval drawer: Decision / Timeline tabs
- Overview tab: TITLE / LOCATION / STATUS / PRIORITY / DUE / UPDATED
  / DESCRIPTION / WAITING ON SIGN-OFF (linked AP-refs) / MOVE THIS
  (state machine buttons)
- Approval Decision: REASON / AMOUNT / PENDING SINCE / NOTES / WILL
  UNBLOCK / Sign off / Reject
- Timeline: comments cards + audit tape + composer

### Problems

**P1. Modal behavior steals context.** When the drawer opens, the
operator can't see the queue. Closing to see context, then
reopening — disrupts flow. (Solved by docked split, per interaction
doc.)

**P2. Overview tab uses too much vertical space per field.** Each
"label above value" pattern eats 28px. A drawer that should be a
dense properties panel is half-empty. Linear-style two-column
key:value would fit 3x the info.

**P3. Tabs are right but in wrong order.** "Costs" before "Files" is
fine, but on a typical WO drawer the operator's most-used tab is
**Timeline** (where coordination happens). Timeline should be the
default tab, not Overview.

**P4. The "WAITING ON SIGN-OFF" section is great but lonely.** This
is the cross-entity causality made visible — and it works. But
there's no equivalent for other causal links: spawned from
inspection, parent project, sibling WOs at the same property, etc.

**P5. The status-change buttons (`Send to vendor` etc.) are big
buttons in a row.** On a narrow drawer they wrap awkwardly. They're
also positioned at the bottom of the Overview tab, requiring scroll.
Should be in the drawer header (next to title) so they're always
visible.

**P6. The composer's "visible to vendor" toggle is a text button,
not a switch.** Operators might miss the visibility state. A
toggle/switch with a clear "visible to vendor" or "internal" label
would be more discoverable.

**P7. Files tab is empty for most entities.** Should the drawer hide
empty tabs entirely, or grey them out?

### Why these matter

The drawer is where 80% of operational work happens. Every small
friction compounds across hundreds of operations per day.

### Redesign direction

**Move 1: Docked split mode.**
- Default behavior on desktop: clicking a row docks the drawer to
  the right half. Queue stays on the left.
- Modal mode (current behavior) available via "expand" button.
- Persistent setting per user.

**Move 2: Properties panel = key:value pairs in two columns.**
```
status     blocked       priority  urgent
due        -2d           updated   -2h
location   247 Maple · 2A
owner      Stark Plumbing Co
```
Tighter, more scannable, less label-dominant.

**Move 3: Timeline becomes the default tab.**
- Coordination tab opens first. Operator lands directly in the
  conversation.
- Overview becomes secondary (still 1 click away).

**Move 4: Actions in the drawer header.**
```
[●] WO-1001 · Bathroom ceiling leak — water through 2A
[assign ▾] [status: blocked ▾] [⋯]                    [✕]
```
- "Assign" opens picker
- "Status: blocked" is the current status — clicking opens the
  transition menu (Send back to triage, Send to vendor, Mark
  resolved, etc.)
- "⋯" is more actions (snooze, set due date, link parent, archive)

**Move 5: "Related" section expands beyond approvals.**
- Pending approvals on this WO (existing)
- Spawned from inspection (if applicable)
- Parent project (if applicable)
- Sibling WOs at the same unit (if any open)
- Recurring template (if spawned from one)
- The vendor's other open WOs

This makes the drawer a navigation hub for the entity graph.

**Move 6: Visibility toggle = switch with clear label.**
- Replace the text-button toggle with a small switch widget
- Label: `Visible to vendor: ON` or `Visible to vendor: off`

**Move 7: Hide empty tabs.**
- Files / Costs only render if count > 0.
- Avoids dead tabs in 60% of WOs.

**Move 8: Add a "Pin" action.**
- Pin the drawer so it survives row navigation (operator continues
  through the queue, drawer stays on the pinned entity).
- Up to 3 pinned drawers in a vertical stack on the right.

### Elite references
- **Linear issue panel** — properties panel, header actions,
  docked-split
- **Figma right inspector** — dense properties, no labels above
- **Superhuman email split-view** — list left, reading right,
  keyboard navigation between

---

## Shell — top bar + left rail + bottom tab (mobile)

Anchors: visible in every screenshot

### Current state
- Top bar (44px): search box + ⌘K · `+` create · 🔔 bell with badge
- Left rail (200px desktop): Now · Work · Compliance · Money ·
  Settings · Inbox
- Bottom tab bar (mobile): same 5 destinations

### Problems

**P1. Top bar wastes ~50% of its width.** Search box is small,
empty space dominates.

**P2. Left rail items have no operational signal.** Money 5 / Inbox
17 / Compliance 3 are unknown until the operator clicks. No badges,
no urgency tone.

**P3. The bell icon duplicates Inbox.** Operators can't tell if
the bell badge = new notifications or something else.

**P4. "Settings" in the daily-use rail is wrong.** It's never a
daily destination. Should be a profile dropdown or pushed to the
footer.

**P5. No "current user / org" context.** An operator switching
between orgs (real prod case for property managers handling
multiple LLCs) has no visible signal which org they're in.

### Why these matter

The shell is the operator's constant frame. Every wasted pixel
compounds. Every missing signal forces a click to discover. The
shell should always answer: *what state is the operation in, who
am I, where am I.*

### Redesign direction

**Move 1: Status line lives in the top bar.**
```
[ STACK OS │ 42 open · 8 overdue · 4 blocked · 5 awaiting ]  [⌘K search]  [+]  [🔔 17]  [AR]
```
- Sits to the right of the brand
- Always visible across all pages
- Each segment clickable to scoped filter
- The `[AR]` is a user avatar / profile dropdown — settings,
  switch org, sign out

**Move 2: Left rail gets count badges.**
- Items with pending work show a numeric badge on the right:
  `Money 5 · Compliance 3 · Inbox 17`
- Tone the badge red when urgency exists (overdue / SLA breach)

**Move 3: Remove the standalone bell from the top bar.**
- Inbox in the rail (with its badge) is sufficient.
- One signal, one place.
- (Or: keep bell for global notifications, lose the inbox-badge
  duplication. Pick one.)

**Move 4: Move Settings out of the daily rail.**
- Into the avatar dropdown
- Frees a rail slot for something operationally useful (or simplifies
  the rail)

**Move 5: Subtle org context in the rail header.**
- Above "Now" in the rail: a small chip showing current org name.
- Click to switch orgs.

**Move 6: Mobile bottom bar.**
- 5 items, same as desktop rail. Don't include Settings.
- Selected tab gets a small dot or accent line.

### Elite references
- **Linear shell** — left rail with counts, top bar search +
  command
- **GitHub** — top bar carries org/repo context persistently
- **Slack** — sidebar with unread counts per channel
- **Bloomberg Terminal** — top bar as persistent status anchor
  (model for the status-line-in-top-bar move)

---

## Out-of-scope surfaces (noted for completeness)

- **/dashboard** — exec view. Probably becomes a CEO-facing layer
  later. Not on the daily-loop path.
- **/dispatcher** — overlapping with /now's needs lane and /work's
  unassigned filter. Consider deprecating in favor of those.
- **/board** (kanban) — should become "Triage" view inside /work
  per the redesign above.

These are all signals that the surface count should *shrink*, not
grow. An operational coordination OS should have 4-5 daily
surfaces, not 10.
