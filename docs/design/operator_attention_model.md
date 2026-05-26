# Operator Attention Model

**Companion to:** [[p9_cockpit_strategy]], [[pressure_first_product_model]],
[[lane_behavior_model]]
**Scope:** how operator attention flows through a real day. Defines the
loops the cockpit must support and the success metrics that mean the
loops work.

---

## Current problem

The product today supports navigation but not flow. Every surface answers
a question, but the **sequence** in which an operator visits surfaces —
the rhythm of a real morning, a real triage hour, a real unblock pass —
is not designed for. Operators end up improvising. Improvisation produces
inconsistent triage, missed pressure, and the same WO opened three times.

The shell has primitives (lanes, drawer, keyboard, ⌘K). What's missing
is a model of **how those primitives compose into operator loops** and
**which loop the system optimizes for**.

`interaction_feel_assessment.md` named this honestly: "the cockpit works;
the queue surfaces still feel transactional." Transactional means each
click is its own decision. Flow means the next click is implied by the
one before.

---

## Proposed evolution

Design the cockpit around **three named loops**. Every interaction
decision (where actions land, what keyboard shortcuts exist, what the
drawer surfaces) is judged by whether it makes the loops faster and
less cognitively expensive.

The loops are not screens. They are sequences. The same surfaces serve
all three loops, but the loops weight the surfaces differently.

---

## The Morning Loop (8am scan)

**Trigger:** operator opens Stack OS at the start of the day. Coffee in
hand. Has not looked at the system since 6pm yesterday.

**Question being answered:** *"What blew up overnight? What do I need to
own first?"*

**Flow:**

1. Land on `/now`.
2. Scan for loud lanes — silhouette pass, ≤500ms. (OVERDUE red?
   NEEDS YOU populated? BLOCKED grown?)
3. Read the **lane header asides** — "oldest 14d · 3 block a turn",
   "$12,400 in approvals". This is the operator's morning brief, in
   one line per lane.
4. Click into the top OVERDUE row.
5. Drawer opens. Memory blocks (unit history, vendor reliability,
   sibling work) load below the action buttons.
6. Read the **drawer header** (status, owner, age). Read the
   **Consequences block** (new). Decide.
7. Press `a` → assign menu → choose vendor → enter.
8. Press `esc`. Drawer closes. `/now` re-renders.
9. Repeat from step 4 until the loud lane is quiet.

**Total time target:** 60–90 seconds for 8–12 decisions on a populated
morning.

**Where this loop lives:** entirely in `/now` + drawer + keyboard. No
tab-switching, no filter chips, no list pages.

**What kills this loop today:**

- Stat tiles consuming above-the-fold space (kill them — see
  [[p9_cockpit_strategy]]).
- Drawer lacking Assign action (P8 DoD gap; add in Stage D of
  [[p9_execution_plan]]).
- Consequence chips missing — operator opens drawer just to find out
  if a WO blocks anything (add chips in Stage C).
- Lane headers without asides — operator has to count rows to
  understand the lane's weight (asides are part of Stage B).

---

## The Triage Loop (mid-day)

**Trigger:** operator has 30 minutes between meetings. Wants to
"clear a chunk" rather than wait for evening triage.

**Question being answered:** *"Which 5 things, if I cleared them, would
most reduce overall pressure?"*

**Flow:**

1. Land on `/now`. Scan NEEDS YOU and BLOCKED.
2. For each NEEDS YOU row, the **consequence chip** (`unblocks WO-1051`)
   is visible inline. Pick highest-consequence first.
3. Drawer → decide (approve / reject / reassign). Press `esc`.
4. After NEEDS YOU is cleared, move to BLOCKED. Use the **reason
   grouping** (`waiting on parts ×4`) — handle one reason at a time.
5. For each blocked row, the drawer "Dispatch" block shows the
   unblock action. Comment, escalate, or follow up with vendor.

**Total time target:** 5–8 minutes for 10–15 triage decisions.

**Asymmetric weighting:** consequence > aging > urgency-of-record.

The mid-day loop is the moment when the cockpit's *consequence-first*
philosophy pays off. A naive system would tell the operator "you have
27 things older than 7 days." Stack OS tells them "you have 4
approvals that, combined, unblock 9 WOs." Same data, different framing,
20× the leverage.

**What kills this loop today:**

- Consequence chips absent → operator can't see leverage at-a-glance.
- BLOCKED rows without reason grouping → operator triages 9 rows
  individually instead of 3 clusters.
- Approval drawer doesn't show what it unblocks → no leverage feedback
  after approving.

---

## The Unblock Loop (vendor-side / async)

**Trigger:** operator is on the phone with a vendor, or just got a
photo over text, or a vendor portal magic-link comment just landed.

**Question being answered:** *"What's the next move on this specific
thread, and does anything else depend on it?"*

**Flow:**

1. Operator presses `⌘K` → types `WO-1043` (entity typeahead, the
   missing P8 DoD piece).
2. Drawer opens directly.
3. Read recent activity (last comment, last status change).
4. Add a comment (`c`), change status (`s`), or assign (`a`).
5. If consequence chip says `blocks WO-1051`, optionally `⌘K` →
   `WO-1051` to push that one forward too.

**Total time target:** 20–40 seconds per thread.

**Where this loop lives:** anywhere. The operator might not have `/now`
open — they're on `/work` or `/inbox` or a meeting tab. ⌘K + entity
typeahead is the universal entry point.

**What kills this loop today:**

- ⌘K entity typeahead missing (P8 DoD gap; add in Stage D).
- Drawer doesn't carry forward across surfaces (it does — keep this
  working).

---

## Asymmetric weighting

The three loops imply a ranking the system must enforce in render order
and sort logic:

```
1. operator-personal pressure  (NEEDS YOU lane)
2. downstream-blocking consequence  (consequence chip)
3. tenant-impact / life-safety  (tier-1 modifier)
4. aging  (lane assignment + severity bar)
5. urgency-of-record (priority chip)
```

This ranking is reflected in:

- **Lane order on `/now`**: NEEDS YOU → OVERDUE → BLOCKED → TODAY →
  IN-FLIGHT → JUST CHANGED.
- **Sort within OVERDUE**: priority DESC → consequence_count DESC →
  dueAt ASC (per [[lane_behavior_model]]).
- **Sort within NEEDS YOU**: consequence_count DESC → amount DESC →
  waiting_since ASC.
- **Inbox notification weighting**: events that imply consequence
  outweigh events that don't.

Note that **lane order on `/now` differs from today**. Today the order
is NEEDS YOU → OVERDUE → BLOCKED → TODAY → IN-FLIGHT → JUST CHANGED
which is close. Verify and lock; do not reshuffle.

---

## The "loud / quiet" discipline

A healthy cockpit at any moment has **~5% of rows looking loud** (red,
amber, pulsing, bold-tinted). The other 95% are quiet — visible but
non-demanding.

If more than 10% of rows look loud at any time, the cockpit has stopped
helping. Operators stop noticing pressure because everything is pressure.
This is the failure mode every legacy enterprise tool falls into.

Discipline mechanisms:

- Severity bar appears only on OVERDUE and NEEDS YOU lanes (and BLOCKED
  in amber). IN-FLIGHT, JUST CHANGED, TODAY have no severity bar.
- Pulse animation runs on the **single oldest OVERDUE row**, not all of
  them.
- Consequence chip is visible on top-3 OVERDUE rows + all NEEDS YOU
  rows; deep-lane rows don't render it.
- Priority chips (URG/HIGH) are visible only on rows where priority is
  load-bearing — i.e., already pressure-bearing. Don't double-decorate.

---

## Success metrics

These are the metrics that mean the loops work. None are dashboarded
(per the no-dashboard principle); they're checked on real-org walks.

| Loop | Metric | Target |
|---|---|---|
| Morning | Time to first action | ≤ 15 seconds from sign-in |
| Morning | Decisions per minute | ≥ 8 |
| Morning | Drawer-trips per decision | ~ 1 (no drawer ping-pong) |
| Triage | Consequence-aware decisions | ≥ 80% of triage actions cite consequence |
| Triage | Reason-cluster usage | BLOCKED rows handled in clusters, not solo |
| Unblock | ⌘K → drawer | ≤ 3 seconds |
| Unblock | Cross-WO follow-through | When chip says "blocks X", operator opens X same session ≥ 60% of the time |

These are operational metrics, not analytics features. They are checked
by sitting next to an operator for 20 minutes; they're not graphed.

---

## Operational reasoning

### Why three loops and not five or twelve

We considered a longer list — "the property walk-through loop", "the
inspection-spawn loop", "the vendor-call loop", "the COI-renewal loop".
All fold into one of the three above.

- Inspection-spawn = morning loop variant (a finding shows up in
  NEEDS YOU; operator decides if it spawns a WO).
- Vendor-call = unblock loop (⌘K to find the WO, drawer to act).
- COI-renewal = triage loop (NEEDS YOU surfaces it; consequence chip
  says how many WOs are gated).

Naming the three irreducible loops keeps the design crisp. New surface
proposals should be tested against the loops: *"does this make morning
faster, triage smarter, or unblock more reliable?"* If none, don't ship.

### Why morning beats afternoon

Triage loops happen multiple times a day; the morning loop happens
once. But the morning loop is the **load-bearing** loop — if it works,
the rest of the day works. If the morning loop fails, the operator
spends the rest of the day catching up, and `/now` accumulates noise.

Optimize morning first.

### Why no AI copilot

We deliberately omit "ask the assistant what to triage first." Reasons:

- The five pressure dimensions + consequence chip are deterministic.
  Operators trust deterministic signal far more than they trust a
  black-box recommendation.
- AI copilots in operations tools tend to become noise generators — they
  produce summaries that the operator must verify. Verification eats
  the time the copilot was supposed to save.
- The product builds the cockpit; the operator does the thinking. The
  moat is making *thinking faster*, not replacing it.

If AI ever earns a place, it lives in narrow, falsifiable slots
(`summarize this 14-message vendor thread`, `extract expiry date from
this COI PDF`). Not in triage.

---

## Tradeoffs

### Risk: loop framing privileges the operator profile we already imagine

Brad and one or two dispatchers may not exhaust the personas. A
field-staff member or a property manager has different rhythms.

Mitigation: the loops above describe the **dispatcher / coordinator**
persona. Field staff use the mobile shell and a much narrower loop
(just-changed + my-assignments). Property managers use the exec
dashboard occasionally (which we're removing — verify with Brad that
this is acceptable).

This doc claims dispatcher primacy. If that's wrong, revise here.

### Risk: success metrics are subjective

"Decisions per minute" is an observed count, not an instrument. We can
measure it via sit-with-the-operator sessions; we can't dashboard it.

Acceptable. The metrics exist to give the design team something to
aim at, not to drive product analytics. The metric that actually
matters — *does Brad open the app in the morning and feel in control?* —
is binary and irreducible.

### Risk: loops imply we know what operators want

We're making strong claims about what 8am feels like in property
maintenance ops. Some claims (consequence > aging) are based on
generalized operations reasoning, not Brad-specific evidence.

Mitigation: the phone-walk validation gate in [[p9_execution_plan]]
Stage G is exactly the moment to revise the loop model. If real
operators say "actually I don't think about consequence in the morning,
I think about tenant complaints," the consequence-first ranking gets
revised in the field.

---

## Companion docs

- [[p9_cockpit_strategy]] — strategic framing
- [[pressure_first_product_model]] — the input to the loops
- [[lane_behavior_model]] — the lanes the loops navigate
- [[cockpit_information_hierarchy]] — the visual order the loops obey
- [[p9_execution_plan]] — the stages that build loop-supporting
  affordances (especially Stage D for drawer actions, Stage C for
  consequence chips)
