# Tier 2 Strategy

**The thesis:** the next leap is not feature growth. It's
**operational cognition** — making the surfaces we have *think* about
the operation, not just enumerate its rows.

The product has crossed three thresholds in the last month:
1. Does it work? — yes
2. Does it feel operational? — yes
3. Would I run a Tuesday morning from here? — yes

What it has not crossed:
4. **Does it know the operation?** — not yet.

Stack OS today is *transactional*: every WO is one ticket, every
approval is one decision, every inspection is one event. The product
doesn't yet know that WO-1001 is the third plumbing call to unit 2A
in 60 days, that Stark Plumbing has been on time 92% of jobs this
quarter, or that the COI expiring on Apex HVAC gates a Saturday
move-in at 89 Elm. **Causality and memory are the missing layers.**
Those layers are also the long-term moat — they're what Linear can't
copy, what AppFolio doesn't build, what generic PM tools have no
ontology for.

This document is the strategic plan to add those layers without
turning the product into a dashboard, an admin panel, or "AI for
properties." It is the anti-feature pass.

---

## 1. Ruthless critique of current Tier 1

**Going through the live `final/` screenshots with the
operator's-9am-Tuesday lens, what still fails:**

### /now — strong, but transactional

The lanes (NEEDS YOU, OVERDUE, BLOCKED, TODAY, IN-FLIGHT, JUST
CHANGED) work as triage partitions. Status line works. Activity
strip works. Per-lane tails work.

What's missing: each row is **operationally isolated**. WO-1001
("Bathroom ceiling leak — water through 2A") sits in the overdue
lane with a red age chip and Stark Plumbing as the assignee. The
dispatcher cannot see, without opening the drawer:

- This is the second leak at unit 2A this quarter.
- 2A's tenant has filed three tickets in 30 days.
- Stark Plumbing has missed two of their last four SLA deadlines.
- This WO is blocking a tenant-requested move-out walkthrough on Fri.

All of that data is **already in the database** (audit_log,
assignments, work_orders.created_at, comments, tenant_users). The
product just doesn't surface it.

**This is the biggest gap.** The lanes are right; the row content is
flat.

### /work — still spreadsheet

Despite the severity rails + low-priority opacity, /work reads as
42 rows of identical rectangles. Operators scrolling /work scan but
don't *triage*. No grouping by pressure. No "above the fold" focus.
The page is good as a catalog; weak as a coordination surface.

**The Tier 1 deferral on urgency banding still bites.**

### /compliance — strong but shallow

CANNOT DISPATCH panel + "blocks N WOs" chips are excellent. But the
chip shows a *count*, not the actual entities. An operator reading
"BLOCKS 2 WOS" must click through to find out which work is at
risk, what those WOs are blocking downstream, whether there's a
tenant impact.

**The consequence is visible at one level of depth, not two.**

### /money — strongest surface, but vendor context thin

The approval drawer's WILL UNBLOCK card is the model — exactly what
causal cognition looks like. But two things missing:
- **Vendor reliability context**: the approver doesn't see "Stark
  has 92% on-time rate, 1 overrun in 30d" inline.
- **Approval pattern**: "Stark has 3 other pending approvals" /
  "this is the 4th budget exception this month."

The decision currently lacks **vendor history** and **org pattern**.

### /inbox — flat priority

Threading + humanized labels + recent timestamps land. But every
notification has equal weight. A "vendor declined assignment"
notification reads at the same visual weight as "weekly cleaning
spawned." The operator scans 20 items in order, not by importance.

**The inbox should encode operational severity, not just chronology.**

### Drawer — best, but ends one layer too early

The drawer earns the "cockpit" framing. WAITING ON SIGN-OFF (WO) +
WILL UNBLOCK (approval) are the cross-entity wedges.

What it doesn't show:
- **Unit history**: "2A: 3 work orders in 60d (2 plumbing)"
- **Vendor history**: "Stark: 92% on-time · 1 overrun this month"
- **Sibling work**: "WO-1014 (gutter clean) open on same property"
- **Tenant impact**: "tenant flagged this WO 3 days ago"
- **Time-to-action**: "scheduled for Fri 2pm; no vendor confirmation"

All of this is one query each. None is built.

### The shell — solid, but the brand mark is a string

`STACK · OPS` reads more like a label than a mark. Functionally
fine; product-design-wise it's the cheapest part of the shell. A
real product would have a 14×14px mark. Low priority. Not a Tier
2 target.

### Cross-surface causality — almost entirely absent

Hovering `WO-1001` anywhere does nothing. The page has no awareness
that the WO ref in the activity strip, the approval row in
/money, and the assigned vendor's COI in /compliance are
operationally connected. Each surface is its own world. **The
graph is structural; the UI doesn't surface it.**

---

## 2. The Tier 2 thesis: cognition, not features

Three layers to build, in dependency order:

### Layer 1: Memory

Every entity has *history*. Every history has *pattern*. The product
should surface:

- **Recurrence** — "3rd plumbing issue at 2A in 60d"
- **Vendor track record** — "Stark: 92% on-time · 4 overruns 30d"
- **Unit volatility** — "247 Maple #2A: 8 WOs this quarter (avg 3)"
- **Operator follow-through** — "you triaged 12 of 14 of these"

These are not analytics. They're **embedded annotations** — a
single subtitle line per row, a single small section in the
drawer. Always specific to the entity in view, never aggregated to
a tile.

### Layer 2: Causality

Memory tells you what happened. Causality tells you what *depends
on what*. The product should surface:

- **Blocking chains**: "approving this unblocks WO-1001 → which
  unblocks tenant move-in Fri"
- **Downstream risk**: "this COI expires in 14d → 3 WOs at risk"
- **Dependency awareness**: "WO-1001 spawned from inspection
  INS-A4BC → finding still open"
- **Cascade visibility**: "Stark currently has 5 active WOs; their
  COI lapses in 7d"

This builds on memory but adds *direction*. Memory is "what is";
causality is "what gates what."

### Layer 3: Relational highlighting (the cross-entity graph)

The third layer is interaction-level: hovering one entity ref
subtly illuminates related entities visible elsewhere on the page.
Quietly magical. Subtle by design. The interaction is what makes
the operational graph **felt**, not just shown.

This is the Palantir-style "ontology surfacing" applied to property
operations. No one else in this market has it. Done right, it's
the long-term moat.

---

## 3. Tier 2 implementation plan

Five phases. Each lands a layer of cognition. Each is structurally
independent (you could ship A without B, but B is more powerful
with A). Phase order is dependency-friendly.

### Phase A — Memory layer in the drawer

**Scope:** the WO drawer gains four new server-loaded sections,
rendered as compact lists, not cards:

1. **Unit history** (when WO has a unit):
   ```
   UNIT HISTORY · 247 Maple · 2A
     3 WOs in 60d   (2 plumbing, 1 electrical)
     last: WO-1023  resolved 14d ago
     tenant: Marcus Webb · 5 tickets all time
   ```

2. **Vendor track record** (when WO has an assigned vendor):
   ```
   STARK PLUMBING · 92% on-time · 1 overrun in 30d
     active jobs: 5 (1 blocked, 1 overdue)
     last completed: WO-1042 · 2d ago
   ```

3. **Spawned from** (when WO came from an inspection or template):
   ```
   FROM   INS-AB12CD  annual inspection · finding "cabinet stain"
   ```

4. **Sibling work** (open WOs at same property):
   ```
   AT THIS PROPERTY · 247 Maple
     WO-1014  Roof gutter cleaning  scheduled +4d
     WO-1099  Annual smoke detector test  -2d overdue
   ```

These are 24-32px compact lines, monospace where it matters,
arrayed below the WAITING ON SIGN-OFF card. No tables. No charts.
Just facts.

**Server work**: 4 new loaders. All single-org-scoped queries
against existing tables. No schema changes.

**Effort**: ~2 days. **Operator-feel delta**: enormous — the
drawer becomes a true cockpit.

### Phase B — Causality propagation across surfaces

**Scope:** consequence chains become visible *outside* the drawer.

1. **/now overdue rows** carry a subtle downstream hint when
   present:
   ```
   WO-1001  URG  Bathroom ceiling leak — water through 2A
              Stark Plumbing  · blocks move-out Fri  -5d
   ```

2. **/compliance expanded violation rows**: clicking a "blocks 3
   WOs" chip opens the drawer with the actual WO list, not just a
   count. Even better — the chip could expand inline to show 1-2
   WO refs when there's room.

3. **/money approval rows** gain a `vendor history` tail when
   relevant:
   ```
   estimate awaiting sign-off  WO-1001  pending 6h  Stark · 92% OT
   ```

4. **Inbox events get operational weight**: notifications about
   blocked/overdue/declined render bolder; routine
   `recurring_spawned` events render at 70% opacity.

**Server work**: 1 new `vendorReliability(vendorId)` helper. 1 new
`woDownstreamHint(woId)` helper. Both are simple queries.

**Effort**: ~3 days. **Operator-feel delta**: the surfaces start
feeling *aware*.

### Phase C — /work true triage surface

**Scope:** the deliberately-deferred Tier 1 piece. /work gets
urgency banding without losing density.

1. **Bands** as inline section headers in the same flat list:
   ```
   OVERDUE 8 · oldest 5d
   [overdue rows]

   BLOCKED 4
   [blocked rows]

   IN-FLIGHT 6
   [in-flight rows]

   SCHEDULED TODAY 2
   [today rows]

   ACTIVE 18
   [active rows]

   BACKLOG 38 · click to expand
   [collapsed by default]
   ```

2. **Default sort within bands**: priority DESC → urgency rank →
   updated_at DESC. Same as today.

3. **"Mine" filter chip at the top**: filters all bands to entities
   assigned to the current user. (One toggle, no extra surfaces.)

4. **Density toggle** (optional): compact (24px) vs comfortable
   (current 32px). Saved per user. Defer to Phase E if scope tight.

**Server work**: none. The data + sort already exist; only
rendering changes.

**Effort**: ~2 days. **Operator-feel delta**: /work goes from
"catalog" to "triage queue."

### Phase D — Cross-entity hover-highlight (the moat)

**Scope:** the relational illumination.

1. **On page mount**, build a client-side index: `Map<entityRef,
   HTMLElement[]>` for every `WO-…` / `AP-…` / `INS-…` / `PRJ-…`
   visible.

2. **On hover** of any entity ref (in a row, in an audit strip, in
   the activity strip, in the drawer's WAITING ON SIGN-OFF card):
   - The hovered ref turns from gray to foreground.
   - Any *other* references to the same entity on screen get a
     5% background-color shift (faint, not loud).
   - Related entities (e.g., approvals targeting this WO, sibling
     WOs at the same unit) get a 3% background-color shift.

3. **No animations.** No motion. The highlight either is or isn't.
   Hover-on → instant; hover-off → instant.

**The trick**: making this *feel quiet*. If we over-saturate the
highlight, it becomes a Christmas tree. The right calibration is
"the operator notices a peripheral change but can ignore it." This
is a taste call, will need iteration after first render.

**Server work**: none (client-side index).

**Effort**: ~3 days for v1, ~1 day for taste-tuning after first
render. **Operator-feel delta**: the product feels *connected* —
the moat.

### Phase E — Inbox priority weighting + filters

**Scope:** /inbox graduates from chronological feed to operational
coordination surface.

1. **Event weight** by `kind`:
   - **High** (red dot, bolder type): `wo_blocked`, `wo_overdue`,
     `approval_decided` (when rejected), `vendor_declined`,
     `coi_expired`, `tenant_insurance_expired`
   - **Standard** (current weight): `wo_assigned`, `comment_*`,
     `approval_requested`
   - **Quiet** (opacity 70): `template_spawned`, `wo_created` from
     system, `coi_received`

2. **Filter chip row at top**: `All · Mine · Mentions · Decisions
   · Compliance`. Each filters the existing list. No saved
   per-user state — just URL params.

3. **Mark as actioned**: each row gets a `✓` button. Dismissed
   notifications hide; bulk action ("dismiss read") at bottom.

4. **No reply-inline yet** (defer). The composer flow happens in
   the drawer; the inbox is the queue.

**Server work**: small — a `dismissed_at` column on notifications
or a per-user `read_state` table.

**Effort**: ~2 days. **Operator-feel delta**: inbox becomes a
coordination surface, not a log.

### Total Tier 2 effort

~12 engineering days across the five phases. Recommend shipping in
this order: A → C → B → D → E. (A first because it's foundational
to B; C is independent and the easiest visible win; B builds on A;
D is the moat and benefits from B's surface enrichment; E is
polish.)

---

## 4. Highest-leverage operational cognition improvements

Ranked by impact-per-day-of-work. (These are the "if I could only
ship three things" picks.)

### #1 — Memory in the drawer (Phase A)

The single highest-leverage move. Adds *facts the operator
currently has to remember in their head* to the surface. After
Phase A, an operator looking at WO-1001 immediately sees: 3rd
plumbing issue at 2A, Stark's reliability, sibling WOs at the
property. **This is where the product earns the right to be called
"operational cognition."**

### #2 — /work banding (Phase C)

Independent of cognition, but it closes the biggest unfinished
piece of Tier 1. The page operators spend the most time on goes
from "spreadsheet" to "queue." Quick win.

### #3 — Cross-entity hover (Phase D)

The moat play. Riskier (taste-dependent). But the *only* feature in
this plan that competitors cannot copy without rebuilding their
data model. If done right, this is the demo-magic moment.

### #4 — Notification priority (Phase E)

Smaller win, but high frequency. Operators see notifications all
day; weighting them by importance compounds.

### #5 — Cause chips on /now rows (Phase B partial)

The `blocks move-out Fri` tail addition is small but pulls in real
cognition. Lower priority than memory itself.

---

## 5. DO NOT BUILD

Explicit anti-roadmap. Each of these would look like a good idea on
a roadmap document and would damage the product:

- **A "Reports" surface.** No analytics page. The product is
  operations, not BI. If the operator wants a report, they export
  CSV. (Already wired.)
- **A "Vendors" CRM-style page.** Vendors exist as drawer context;
  building a vendor-detail page invites scope creep into
  procurement/vendor mgmt territory.
- **A "Properties" surface beyond the existing admin.** Same
  reason. Property data is reference, not destination.
- **An AI assignment assistant.** Suggesting vendors based on
  history is statistically tractable; surfacing as "the AI
  recommends Carlos" damages trust if wrong. Show data; let humans
  decide.
- **Vendor self-serve portal expansion.** Magic-link works; don't
  add vendor inbox, vendor analytics, vendor anything.
- **Tenant self-serve portal expansion.** Same — keep it minimal.
- **Real-time presence ("Sara is viewing this WO").** Looks cool;
  zero operational value; high implementation cost.
- **A workflow builder.** Operators shouldn't configure workflows
  — the engineer should. If we need new state machines we add
  them in code, not in UI.
- **Custom fields on entities.** The schema is the schema.
  Customization belongs in CSV exports + downstream tools.
- **Reminders / snoozing as a first-class feature** (beyond the
  inbox `✓ dismiss`). Operators have a calendar.
- **Mobile gesture system (swipe to assign).** Separate pass; not
  in scope here.
- **Internationalization.** Not now.
- **Dark mode polish.** Already wired; not Tier 2's job to make it
  prettier.
- **Onboarding tour / coach marks.** The shortcut overlay (`?`) is
  the only onboarding affordance.
- **Calendar view.** Operators have Google Calendar; integration
  via iCal export is sufficient.
- **Map view.** Looks beautiful on screenshots; operators don't
  action it daily.
- **Slash commands in comments.** Notion-y. Not operator-y.
- **Activity heatmaps / streaks / "operator of the month."** Hard
  no. Gamification corrupts the product.
- **PWA push notifications.** Email is sufficient.
- **Chat / DM between operators.** Not a chat app.

This list is not exhaustive but it captures the *pattern*: if a
feature would look at home in Linear, Notion, Asana, ClickUp,
Hubspot, or Salesforce, it probably doesn't belong here.

---

## 6. Detailed execution sequencing

### Sprint 1 (1 week) — Phase A foundation

Day 1-2: Three new server loaders.
- `loadUnitHistory(unitId)` → WO count over windows, recent
  resolved entries, tenant ticket count.
- `loadVendorReliability(vendorId)` → on-time rate, overrun count,
  active job count.
- `loadSiblingWork(propertyId, excludeWoId)` → open WOs at same
  property.

Day 3-4: Drawer sections + visual treatment. Compact lines, no
cards.

Day 5: Typecheck, tests, screenshots, deploy.

**Deploy gate:** the drawer feels twice as informative for the
same vertical space.

### Sprint 2 (1 week) — Phase C /work banding

Day 1: /work data layer — group WorkRows by urgency band server-side.

Day 2-3: Page rendering — inline section headers, collapsed
backlog band, "Mine" toggle.

Day 4: Polish + screenshots.

Day 5: Deploy.

**Deploy gate:** /work reads as a triage queue, not a spreadsheet.

### Sprint 3 (1 week) — Phase B causality

Day 1-2: `woDownstreamHint(woId)` server helper (e.g., scheduled
inspections, blocked move-outs).

Day 3: /now overdue rows + /money approval rows pick up the new
contextual tails.

Day 4: /compliance violations expand inline to show actual blocked
WO refs (1-2 visible, "and N more" overflow).

Day 5: Inbox event weighting (`kind → priority` mapping).

**Deploy gate:** surfaces feel *aware* — the operator reads
consequence without opening the drawer.

### Sprint 4 (1 week) — Phase D cross-entity highlight

Day 1-2: Client-side ref index + hover handlers on entity refs.

Day 3: Faint background tinting; calibration; taste pass.

Day 4: Real-world testing on populated screens; iterate on
highlight intensity.

Day 5: Deploy + monitoring.

**Deploy gate:** hover an entity ref → on-screen relatives glow
faintly. Operator says "oh, that's cool" within 30 seconds.

### Sprint 5 (optional, ~3 days) — Phase E inbox polish

Day 1: Per-user dismissed_at schema + server action.

Day 2: Filter chips + dismiss UI.

Day 3: Deploy.

This is optional in the sense that it's the smallest delta. Could
push to Tier 3.

### Total: 4-5 weeks for full Tier 2

If forced to ship only one sprint of work: **Sprint 1 (Phase A)
alone justifies the deploy.**

---

## 7. Likely over-design traps

Where this pass could go wrong:

### Trap 1 — Memory becomes a dashboard

Risk: "Unit history" section becomes a 4-tile grid showing
"4 WOs this quarter | 2 plumbing | $1,200 spent | 95% on-time."
That's the dashboard reflex.

Discipline: memory is **two-three lines of monospace prose**. Never
visualized. Always specific. If a section needs a chart, it's the
wrong section.

### Trap 2 — Vendor reliability becomes a scorecard

Risk: "Stark Plumbing · 92% OT · 4.6★ · A+ rating." That's a vendor
management app. We're not building that.

Discipline: reliability is **one inline phrase** ("92% on-time, 1
overrun in 30d") embedded next to the vendor's name. No badges. No
ratings. No comparisons to other vendors.

### Trap 3 — Causality chips multiply

Risk: every row sprouts contextual tails. "blocks move-out Fri" +
"3rd in 60d" + "Stark · 92% OT" + "$1,450 pending" + "tenant escalated"
all on the same row. The page reads like Bloomberg.

Discipline: **one cause-chip per row maximum**. The most operationally
important consequence. Quietest possible typography. Render only when
the value is non-obvious (skip "blocks move-out" if there's no
move-out scheduled).

### Trap 4 — Hover-highlight is too loud

Risk: hover a ref → 12 elements on screen blink to bright yellow.
Operator goes blind.

Discipline: **5% background-color shift maximum**. No animation.
Iterate until "you only notice it if you're paying attention."

### Trap 5 — Banding fragments the eye

Risk: /work bands become 8 sub-tables with headers, separators, and
gaps. The page loses density.

Discipline: bands are **single-line inline section headers** at
~11px caps with the count. No card containers. The list stays a
list; the headers are inline interrupts.

### Trap 6 — System memory data is wrong

Risk: "Stark: 92% on-time" surfaces an incorrect statistic, operator
loses trust. Worse than no stat.

Discipline: define statistics narrowly + auditable:
- "On-time" = WOs where `completedAt <= dueAt`
- Window = last 30 days
- Show only when there are at least 5 jobs in the window (no
  confidence on small samples).

If the statistic isn't reliable, **don't surface it**.

### Trap 7 — Hover-highlight reveals too much

Risk: hovering WO-1001 highlights 30 elements (every audit log
event, every notification, every COI). Visual noise.

Discipline: highlight only **directly related** entities (linked
approvals, assigned vendors, spawning inspections). Skip
audit/notification mentions (they're noise).

### Trap 8 — Phase D ships before Phase A/B

Risk: hover-highlight is the most novel/exciting move. Building it
first means it has nothing rich to highlight.

Discipline: ship A → C → B → D in order. Hover gains power as
surfaces become richer.

---

## 8. Information hierarchy evolution

The current row is:
```
[bar] ●  WO-1043  URG  Title — Location               Owner -5d
```

Tier 2 evolution: same physical row dimension, but with an
**optional second visual line of inline subtitle** when the row
has operationally important context:

```
[bar] ●  WO-1001  URG  Bathroom ceiling leak — 247 Maple · 2A
                       blocks move-out Fri · 2nd leak 60d        Stark · -5d
```

Constraints:
- Subtitle line is **9-10px**, muted gray, monospace.
- Renders only when the value is non-obvious (no subtitle for
  routine work).
- Maximum **two pieces of information** in the subtitle.

The row height grows from 32px to ~40px **only on rows that have a
subtitle**. Most rows stay at 32px. The hierarchy is built into
the layout: cognitively important rows take more vertical real
estate; routine rows compress.

**The drawer evolution:**

Currently the drawer Overview tab has:
```
LOCATION · STATUS · PRIORITY · DUE · UPDATED · DESCRIPTION ·
WAITING ON SIGN-OFF · MOVE THIS
```

Tier 2 adds (after WAITING ON SIGN-OFF, before MOVE THIS):

```
UNIT 247 Maple · 2A
  3 WOs in 60d (2 plumbing, 1 electrical)
  tenant Marcus Webb · 5 tickets all time

VENDOR Stark Plumbing
  92% on-time · 1 overrun in 30d
  5 active jobs (1 blocked, 1 overdue)

ALSO HERE
  WO-1014  Roof gutter cleaning · scheduled +4d
  WO-1099  Annual smoke detector test · overdue 2d
```

Three compact sections, monospace where it matters. ~150px of
vertical space added. No cards. No metrics tiles.

---

## 9. Surface merge / remove recommendations

The product should *shrink* surface count in Tier 2, not grow it.
The five operational destinations in the rail (Now, Work,
Compliance, Money, Inbox) are the right set. Inside those
destinations, here's what should be cleaned up:

### Remove from app

- **`/dispatcher`** — already unlinked from nav. Delete the route
  in Tier 2. Functionality replicates /now + /work.
- **`/admin/*` legacy pages** — keep but stop adding to. They're
  the escape hatch during the redesign cutover.

### Merge / fold

- **`/board`** — already redirects to `/work?view=board`. Stable.
  Do not add features to it.
- **`/help`** — keep, route the `?` shortcut overlay there as a
  static page for non-keyboard users.
- **`/settings`** — already removed from rail. Leave in Clerk
  UserButton dropdown.

### Surfaces NOT to add (this list is the discipline)

- No `/insights`, `/reports`, `/analytics`, `/dashboards`,
  `/metrics`.
- No `/vendors/[id]` page (vendor data lives in drawers).
- No `/units/[id]` page (unit data lives in drawers).
- No `/tenants` (tenant data lives at the unit level).
- No `/properties/[id]` page (already exists as
  `/admin/properties/...`; don't expand it).
- No `/calendar`, `/map`, `/timeline`.

The product is at **five destinations**. The strongest version of
this product stays at five.

---

## 10. The deeper bet

Stack OS is wagering that **operational coordination is a wedge
worth specializing in.** Property management is a $20B+ category
saturated with feature-complete systems of record (AppFolio, Yardi,
Buildium). None of those systems are *operational coordination*
tools. They're transactional databases with form UIs.

Coordination is a different category — it's what dispatch software
does for taxi fleets, what PagerDuty does for incidents, what
Palantir does for intelligence operations. The unifying pattern is
that the product is *aware of its data*, not just a window into
it.

Tier 2 is the bet that this awareness is achievable inside a small
product, against well-funded incumbents, by leaning into a single
ontological insight: **the work flowing through a property
management company is a graph of dependencies**, not a list of
tickets. AppFolio doesn't model this graph. Yardi doesn't model
this graph. None of the generic PM tools do.

The five-phase plan above builds the layer that surfaces this
graph. Memory + causality + hover-illumination = a product that
*thinks* about the operation it's coordinating. That's the
defensible bet.

If Tier 2 lands, the product reaches the threshold where an
operations manager doesn't *use* Stack OS in the same way they use
AppFolio. They *run their day through it*. That's the difference
between a system of record and a system of work. And it's the
quietest path I can articulate from "this is a good operational
tool" to "this is inevitable."

---

## What to do this week

If you want to start: **Sprint 1 (Phase A, memory layer)**. Four
server helpers + four drawer sections. Five days of work. Highest
single-sprint operator-feel delta in the entire Tier 2 plan.

If you want to defer: walk the deployed Tier 1 product first.
Let real morning-loop usage surface the actual highest-pain gaps.
The hypothesis here is that memory + causality matter most; live
walkthroughs may surprise us.

The product has earned the right to be evaluated as elite operator
tooling. The remaining work is no longer about building the tool.
It's about teaching the tool to think.
