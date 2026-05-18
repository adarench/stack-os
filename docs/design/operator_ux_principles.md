# Operator UX Principles

**Purpose:** the spine the other four design docs hang on. If a proposed
change doesn't trace back to one of these principles, it's design noise.

---

## Frame: what we are building

**Stack OS is an operational coordination OS for property maintenance.**

That phrase has been load-bearing for a while; this pass commits to it
hard. The thing being coordinated isn't "work orders" — it's the
**causal mesh** between five domains that all feed each other:

```
   approvals ───┐
                 ├──→ dispatch ──→ field execution ──→ verification
   compliance ──┘                              ↑
                                               │
                              vendor state ────┘
```

A vendor losing their COI doesn't just appear on a compliance page —
it propagates into "WOs that cannot be assigned." A pending approval
isn't a financial event — it's a *blocker* on an overdue WO. An
overdue inspection cascades into spawned work orders + missed renewals.

**The product gets special at the seams.** Elite operators don't think
in tables; they think in causality. Linear is best in class for "issue
tracker"; Palantir Foundry is best in class for ontologies; Stack OS
has a chance to be best in class for **coordination across these
ontologies**. Everything below serves that bet.

What we are NOT building:
- A property-management ERP (AppFolio's lane — accounting, leases, AP/AR)
- A generic PM tool (Asana / ClickUp / Monday — task list with status)
- A BI dashboard (DOMO / Looker — read-only analytics)
- A help-desk ticket system (Zendesk — ticket lifecycle without ops graph)

The product reference set is: **Linear, Palantir Foundry, Superhuman,
PagerDuty, Ramp internal ops, dispatch/CAD systems, air-traffic control.**

---

## Principle 1 — Pressure has visual weight

Today every row weighs the same. An overdue urgent leak and a routine
quarterly filter swap render as 32px-tall siblings with the same
typography and the same chip vocabulary. **The eye cannot triage.**

The principle: *operational urgency must be detectable in peripheral
vision.* A trained operator scanning a queue should land on the
highest-pressure row in <300ms without reading text — color, weight,
position, and motion all carry signal.

Concretely:
- Urgent rows get a left-edge priority bar (Linear). 3px is enough.
- Lane headers with red counts get bolder typography, not just a
  color swap.
- The status line on /now should treat a non-zero red number as
  visually different from a non-zero green number — not just hue.
- Aged rows should desaturate, not stay full-tone.

Anti-pattern: making everything louder. The opposite of "everything
loud" isn't "everything quiet" — it's *modulated*. Most rows should
be visually small; the loud rows borrow their loudness from the
quiet ones.

## Principle 2 — Keyboard-first, mouse-acceptable

Today the only keyboard model is ⌘K. Everything else is mouse
clicks: opening a row, switching tabs, applying a filter, posting a
comment. Operators living in this app 8 hours a day will not
tolerate that.

The principle: *any high-frequency action must be 1–2 keys.* The
mouse is the fallback for new-user discovery, not the daily mode.

Reference: Superhuman built an entire $260/year business on the
fact that operators will pay to never lift their hand to a mouse.
Linear's keyboard map is one of the reasons engineers prefer it
over Jira.

Concretely (next doc spells out the actual map):
- `j` / `k` navigates rows
- `o` / `enter` opens the row (drawer or split pane)
- `e` opens command palette scoped to the row
- `c` opens the comment composer
- `s` opens a status menu inline
- `?` shows the help overlay
- All actions visible in the UI must have a keyboard label tooltip

This is non-negotiable for the "elite operators" framing.

## Principle 3 — Coordination beats observation

Today most surfaces are read-only. /now lets you see the state of
the world; the drawer lets you see the state of an entity; the
inbox lets you see notifications. **None of these are coordination
surfaces.**

Coordination is the operator's actual job. They are not "checking
the dashboard" — they are: dispatching, escalating, negotiating
with vendors, deciding, reassigning, holding the line.

The principle: *every read surface earns its place by exposing the
right action at the right moment.* If the operator has to leave a
surface to do the obvious next thing, the surface failed.

Concrete tests:
- On the /now overdue lane, can the operator escalate without
  opening the drawer? Today: no.
- On the /money approval row, can the operator see *why* this
  decision matters before deciding? Today: yes (consequence chip
  already exists — keep this; expand it).
- On the inbox, can the operator reply to a comment that just
  landed without bouncing through the drawer? Today: no.
- On the activity strip, can the operator @mention a teammate
  about a thing that just happened? Today: no.

The competitive moat is here. Linear-for-issues doesn't have to
solve cross-entity coordination. Stack OS does.

## Principle 4 — Causality is the product

Today causality is *implied* — the WO drawer shows "WAITING ON
SIGN-OFF" with linked approvals, the approval drawer shows "WILL
UNBLOCK" with the linked WO. This is correct directionally but
underplayed.

The principle: *operators should feel the connections between
entities, not just see them.* Causality is structural to the
product; it should be structural to the visual language.

Concretely:
- Hovering over an overdue WO row could subtly highlight any
  related entities elsewhere on screen (the pending approval in
  the needs lane; the vendor with the expired COI; the next
  inspection at that property). This is the "operations graph"
  surfacing at the interaction layer.
- The drawer's "WILL UNBLOCK" card is the keystone — extend the
  same pattern to: "WILL UNFREEZE these template spawns," "WILL
  RELEASE this vendor for dispatch," "WILL CLOSE this audit
  finding."
- When the operator marks a vendor's COI restored, the system
  should visibly *reactivate* the WOs that were blocked. Not just
  "they appear in the queue again" — a moment where the operator
  sees the unblock happen.

Air traffic control terminals don't just show airplanes; they show
*conflicts* between airplanes. That's the model.

## Principle 5 — Calm by default, loud when warranted

Today the activity strip ticks every 60s, the auto-refresh fires
every 15s on /now, and the live indicator pulses always. The
"alive" signal is constant.

The principle: *constant motion makes urgency invisible.* The room
should be quiet so that when something escalates, the operator
notices.

Concretely:
- The live indicator can be calmer (single non-pulsing dot,
  smaller).
- The activity strip rows should not animate in unless there's a
  reason (new event since last visit).
- SLA breaches and overdue escalations should get a *briefly*
  louder visual treatment (a 2-second pulse, a transient toast)
  and then settle back into the queue.
- An idle queue should feel idle — not "watching, ready" with
  pulsing dots.

This is Bloomberg Terminal anti-pattern territory if we're not
careful. Bloomberg has motion everywhere and operators learn to
ignore all of it. Linear's restraint here is the better reference.

## Principle 6 — The drawer is the cockpit, not a modal

Today the drawer is a right-side overlay. When it opens, it blocks
~40% of the page. The operator either reads context (drawer) or
sees queue (page), not both.

The principle: *the drawer is where work happens; it should not
make the rest of the work disappear.*

Concretely (interaction doc develops this):
- The drawer becomes a docked split-view. Queue stays scrollable
  on the left, entity stays on the right.
- Closing the drawer with `esc` is preserved; collapsing it to a
  thin rail is added (so the operator can keep the entity
  "pinned" while working other rows).
- Multiple drawer pins (Superhuman split-list inspiration) so the
  operator can stage three approvals for comparison.

## Principle 7 — Avoid the dashboard reflex

Every operational software project gets dragged toward a
dashboard. KPI tiles, sparklines, trend arrows, donut charts —
they look like operational software in screenshots but operators
don't use them.

The principle: *if a piece of UI summarizes data but doesn't
suggest an action, it's decoration.* Decoration is forbidden on
operator surfaces.

Tests:
- The /now status line: every segment is clickable into a scoped
  surface. ✓
- A KPI card showing "Avg resolution time 3.2d ↑": this is a
  read-only summary. ✗ Don't ship this.
- A donut chart showing "% on-time by trade": who actions this at
  10am Tuesday? Nobody. ✗
- The lane subhead "oldest 14d": this *is* an action prompt (do
  something about that). ✓

When in doubt: would an air-traffic controller want this on their
screen? If the answer is "they'd glance at it once a quarter,"
move it to a separate analytics surface (or skip it).

## Principle 8 — Operator language always

Today this is partially solved — the language pass replaced
"estimate_over_threshold" with "estimate awaiting sign-off."
Keep going.

The principle: *no string visible to the user should sound like a
column name.* Operators say what they say. We mirror it.

Tests:
- "wo_blocked" notification kind label → "blocked"
- "approval_decided" audit verb → "decided"
- "in_progress" status → "in progress"  
- "Assign-gate violations" header → "Cannot dispatch"
- "Tenant insurance" tab → consider "Renter policies" (closer to
  vernacular)
- "Vendor COIs" tab → consider "Vendor insurance" (drop the
  acronym; operators don't say "COI" in conversation)

This is recurring work — every new audit event, status, or label
that lands should be reviewed through this filter.

---

## What success looks like

If we're succeeding against these principles, in six months an
operator using Stack OS for the first time should feel:

1. **Fast.** I can move through the queue without clicking.
2. **Calm.** The screen is quiet until something needs me.
3. **Trusted.** I can see what's blocking what. I can predict
   what will happen next.
4. **Empowered.** I can act from anywhere. I don't have to
   navigate.
5. **Specific to this work.** This isn't ClickUp wearing a
   property-management costume. The categories, the buttons, the
   phrasing all belong to property operations.

If we're failing, it'll show as:
- Operators reverting to spreadsheets or AppFolio for the "real"
  work
- Slow adoption of the drawer
- The /now page becoming a glance-and-leave surface instead of a
  living workspace
- The product looking like every other vertical-SaaS app at a
  glance

The remaining four docs translate these principles into concrete
choices.
