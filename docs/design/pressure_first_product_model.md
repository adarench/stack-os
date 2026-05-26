# Pressure-First Product Model

**Companion to:** [[p9_cockpit_strategy]]
**Status:** conceptual model. No code follows from this doc alone — see
[[lane_behavior_model]] and [[p9_execution_plan]] for render and execution.

---

## Current problem

The shell shipped in P8 still treats records as the unit of cognition.
The schema is in records (work_orders, inspections, projects, approvals,
COIs). The queries return records. The rows render records. The drawer
opens one record at a time.

But operators do not think in records. They think in pressure:

- "What's about to blow up?"
- "Who's blocked because I haven't answered yet?"
- "Which two things, if I cleared them, would unblock six others?"
- "Is anything aging silently that I'd regret missing?"
- "Whose plate is too full?"

Every line of that vocabulary is a pressure concept — a derived,
cross-entity, time-weighted signal — not a record. The product as
currently shipped forces the operator to translate from record to
pressure in their head, dozens of times per scan. That translation
**is** the cognitive load Stack OS exists to eliminate.

---

## Proposed evolution

Make **pressure the first-class object**. Records remain the persistent
substrate, but the rendered layer — what the operator scans, weights,
clicks, and acts on — is pressure.

Pressure is not one signal. It is a small, formal taxonomy of five
dimensions. Every entity-row that surfaces in the cockpit carries at
least one pressure dimension. Entities with zero pressure dimensions
**do not surface in `/now`** — they live in `/work` backlog.

### The five pressure dimensions

#### 1. Aging pressure

**Definition:** An entity has been in a state longer than the operator's
implicit clock for that state. A "new" WO five days old. A "triaged"
WO with no assignment after 24h. A blocked WO with no comment in 7d.

**Detection signal:**
- `lastActionAt` or state-entry timestamp older than per-state SLA
- Currently: `dueAt < now()` for overdue WOs
- Extend: per-state SLA table (new→triaged: 4h, triaged→assigned: 24h,
  blocked→any progress: 72h)

**Render channel:**
- Lane assignment (OVERDUE)
- Severity bar (3px red/amber on row left edge)
- Lane header aside ("oldest 14d")
- Drawer "Aging" line in the Operational block

#### 2. Blockage pressure

**Definition:** Forward motion is gated on something outside this WO.
Awaiting parts, awaiting landlord, awaiting tenant access, awaiting
approval, awaiting COI renewal.

**Detection signal:**
- `status = 'blocked'` with a `blocked_reason` field
- COI-gate violations (vendor has no active COI but is assigned)
- Pending approval row referencing the WO

**Render channel:**
- Lane assignment (BLOCKED)
- Reason chip in row tail ("waiting on parts")
- Drawer "Dispatch" block — what's the unblock action?
- Cross-surface: blocked-by-approval rows show consequence chip
  "blocks WO-1043"

#### 3. Downstream consequence pressure

**Definition:** This entity, unresolved, prevents progress on N other
entities. Most important dimension; currently weakest in the shell.

**Detection signal:**
- WO blocks a turn (parent project of kind `unit_turn` with
  state `active`)
- COI gap → vendor blocked from new assignments → backlog grows
- Approval pending → vendor can't start → WO frozen
- Inspection finding spawn count

**Render channel:**
- Row-tail consequence chip ("blocks 3 WOs", "delays turn",
  "tenant-occupied")
- Lane-header aside ("3 block a turn" in OVERDUE)
- Drawer "Consequences" block — what depends on this, with refs

**Cross-entity:** consequence pressure is the connective tissue that makes
hover-highlight (Tier 3) feel meaningful. Without consequence-chip
surfacing, the hover-graph is decoration. With it, the hover-graph is
*operational awareness*.

#### 4. Tenant-impact pressure

**Definition:** A real person is affected. Habitability, life-safety,
move-in or move-out timing.

**Detection signal:**
- WO category = `plumbing` / `electrical` / `hvac` / `appliance` AND
  unit `occupied = true`
- WO category includes `life_safety` (gas leak, water intrusion, lock
  failure)
- WO blocks a move-in scheduled within 5 days
- Tenant insurance expired

**Render channel:**
- Row prefix chip ("tenant" or "life-safety")
- Severity bar tone (life-safety always red regardless of urgency)
- Drawer "Tenant context" block (already shipped in Tier 3)

#### 5. Operator-personal pressure

**Definition:** The operator viewing the screen is the bottleneck. They
own an approval, an assignment, a comment-thread reply, a finding review.

**Detection signal:**
- `approvals.approver_user_id = current_user`
- `assignments` row with `actor_user_id = current_user`
- Unread `external` comment on a WO the operator owns

**Render channel:**
- Lane assignment (NEEDS YOU)
- Row prefix ("you · approve $5,400")
- Top-bar pulse count
- Inbox weight boost

---

## Operational reasoning

### Why this taxonomy and not a continuous "urgency score"

We considered a single derived urgency number — combine the five
dimensions into one float, sort by it. Rejected. Two reasons:

1. **Operators care about which kind of pressure.** "Blocked on parts"
   and "tenant-impact emergency" are not interchangeable; they require
   different actions. A scalar collapses the cognitive distinction the
   product is trying to preserve.
2. **Pressure dimensions map to lanes.** The cockpit is already
   lane-structured; making lane = pressure dimension keeps the visual
   model and conceptual model in lockstep.

### Why these five and not more

- We tried "vendor-constraint pressure" (your only HVAC is overloaded)
  as a sixth dimension. It folds into operator-personal (the dispatcher
  is the bottleneck because they haven't chosen a backup vendor) or
  blockage (the WO is blocked on vendor availability).
- We tried "financial pressure" (this WO is overrunning estimate). It
  folds into operator-personal (someone needs to approve the overage)
  or surfaces in `/money` directly.
- We tried "compliance pressure" (expiring COI). It is a blockage signal
  with cross-surface render in `/compliance`.

Five is the right floor: any fewer and dimensions collapse and lose
distinct render; any more and the lane-pressure mapping fragments.

### Pressure ≠ priority

`priority` (urgent/high/normal/low) is set by the operator at creation.
It is an *input*. Pressure is a *derived state* over time. A normal-priority
WO can accumulate aging + consequence + tenant-impact pressure and
demand attention; an urgent-priority WO that resolves quickly never
acquires pressure beyond its priority chip.

The product surfaces priority weakly (URG/HIGH chips on EntityRow today)
and pressure strongly (lane assignment, severity bar, consequence chip).

---

## Render channel matrix

A quick reference for which dimension renders where:

| Dimension | Lane | Bar | Chip | Drawer block |
|---|---|---|---|---|
| Aging | OVERDUE | red/amber | "oldest 14d" header aside | Operational block |
| Blockage | BLOCKED | amber | reason chip | Dispatch block |
| Consequence | (modifier) | (modifier) | "blocks 3" tail chip | Consequences block (new) |
| Tenant-impact | (modifier; can override lane) | red if life-safety | "tenant" / "life-safety" prefix | Tenant block (shipped Tier 3) |
| Operator-personal | NEEDS YOU | (none) | "you · …" prefix | (drawer is the action surface) |

Consequence and tenant-impact are **modifiers** — they amplify whichever
lane an entity already occupies, rather than placing it in a unique lane.
That keeps the lane count at six (per [[lane_behavior_model]]) while
letting two entities in the same lane look meaningfully different.

---

## Tradeoffs

### Risk: pressure is computed; computation cost matters

Five dimensions, computed per row, across six lanes, every page render. If
naively implemented this becomes a join festival. Mitigations:

- **Per-org pressure rollup** in an Inngest hourly job
  (`task_pressure_signals` table with `entity_ref`, `dimension`,
  `magnitude`, `expires_at`).
- Pressure dimensions degrade gracefully: if the cross-entity consequence
  loader times out, the row renders without the chip — no broken UI.
- Tier 3 already established the pattern with `row-hints.ts`: gated,
  thresholded, fail-quiet.

### Risk: pressure feels arbitrary if thresholds are wrong

Pressure dimensions have thresholds (when does aging start? how many
downstream WOs counts as "blocks N"?). Wrong thresholds and the cockpit
either screams or stays silent.

- Ship with conservative defaults derived from the seeded org's
  distributions.
- Make thresholds per-org configurable (a row in `org_settings`).
- Add a `pressure_calibration` admin page only when real-org data shows
  drift. Don't pre-build the calibration UI.

### Risk: operators ignore pressure dimensions they don't trust

If the system says "blocks 3 WOs" and the operator clicks through and
finds only 1 actually blocked, trust dies in one click. Mitigation:
**conservative thresholds** + **drill-down honesty** — the drawer
Consequences block lists the *exact refs* claimed, with clickable links.
Pressure must be falsifiable.

---

## What pressure-first does NOT mean

- It does not mean removing record concepts. Records persist; the schema
  is unchanged.
- It does not mean adding charts or analytics. Pressure is rendered
  inline, not in dashboards.
- It does not mean a new database table for "pressure events" — just the
  one rollup table above, optional and lazy.
- It does not mean AI inference. Every dimension above is deterministic
  from existing schema state.

---

## Companion docs

- [[p9_cockpit_strategy]] — the umbrella; the 5 surfaces; the 7
  decisions
- [[cockpit_information_hierarchy]] — how pressure renders visually
- [[lane_behavior_model]] — pressure-to-lane mapping with per-lane
  morphology
- [[operator_attention_model]] — how operators weight pressure across
  the day
