# P9 — Cockpit Strategy

**Status:** strategy locked, implementation deferred to a downstream phase.
**Audience:** anyone who touches the operator shell. Read this first; the
other six P9 docs flow from this one.

---

## Thesis

Stack OS is no longer property management software. It is an **operational
coordination operating system** — a cockpit for managing pressure, throughput,
and downstream consequence in a maintenance organization. The product's
center of gravity is not records. It is **operational pressure**.

Operators should not think *what rows exist?*  
They should think:

- what requires attention
- what is blocked
- what is escalating
- what is causing downstream consequences
- what can be unblocked fastest

P0–P8 built the architecture and the shell that makes this thinkable.
P9 locks the strategy that makes it the product.

---

## Why this matters

The shell shipped through Tier 1–3 is structurally elite (severity hierarchy,
keyboard model, docked drawer, memory layer in the drawer, cognition spread
across surfaces). The honest assessment in `interaction_feel_assessment.md`
graded the cockpit at 9/10 and the queue surfaces at 5/10. The gap is not
craft. The gap is **conceptual** — most surfaces still present rows of records
when they should present zones of pressure.

If we close that gap without expanding scope, Stack OS becomes the only
product in the category that thinks the way operators already think. That is
the moat. Every other PM/ticket tool — Asana, Trello, Jira, Zendesk, even
AppFolio — is a list-of-records product. Operators translate from "rows"
into "pressure" in their heads every minute. Stack OS removes the translation.

---

## The 7 priority decisions

The user posed 7 product questions. Each is answered here in one paragraph.
The five sibling docs unpack each in depth.

### 1. /now becomes the primary product

`/now` is the cockpit. `/work` survives as a **power-lens** — saved-view
slicing of the full WO/INS/PRJ corpus (Mine, Overdue Mine, Vendor X, Property
Y), not a free-form filter catalog. Backlog lives on `/work`, not on `/now`.
An operator who opens Stack OS in the morning lands on `/now` and stays there
for 80% of their day; `/work` is where they go to chase down a specific
slice they can't see from the cockpit. See [[lane_behavior_model]].

### 2. Lanes get distinct morphology

Today all six lanes use the same `EntityRow` with minor tail variations.
Going forward each lane is a **projection** of the row — different fields,
different emphasis, different interaction tier. OVERDUE feels *dangerous*.
BLOCKED feels *constrained*. IN-FLIGHT feels *throughput-oriented*. JUST
CHANGED is *ephemeral*. NEEDS YOU is *operator-personal*. TODAY is
*time-anchored*. Lane is the mental model; row morphology must reflect it.
See [[lane_behavior_model]].

### 3. Card / list hybrid: minimal list with selective expansion

Cards are PM-tool energy. Trello-style cards, Asana-style tiles, and
drag-drop kanbans are explicitly rejected — they encode the wrong mental
model. The product stays in edge-to-edge minimal-list territory, with
selective row-level expansion: **top-of-lane rows expand** to surface
consequence inline; **deep-lane rows collapse** to single-line, low-contrast
form. See [[card_list_hybrid_exploration]].

### 4. Attention hierarchy

Attention is asymmetric. From most-deserving to least:

1. **Operator-personal pressure** — you're the bottleneck
2. **Downstream-blocking consequence** — this blocks N WOs / a turn / a
   move-out
3. **Aging** — this is the oldest unmoved
4. **Tenant-impact** — life-safety / habitability
5. **Vendor-constraint** — your only HVAC vendor is at 4 active jobs

Currently the product shows urgency + aging strongly. P9 promotes
**consequence above aging** — a 12-day-old WO that blocks nothing is less
important than a 2-day-old WO that blocks a $4,500 turn. See
[[operator_attention_model]].

### 5. Causality without graph viz

Three mechanisms, no diagrams:

- **Row-tail consequence chips** — `blocks 3 WOs`, `delays turn`,
  `tenant-occupied`. Replace some right-tail content rather than adding
  more chrome.
- **Cross-entity hover-highlight** — already shipped in Tier 3. Keep,
  deepen, tune the tint.
- **Drawer-open cross-surface tint** — when a WO drawer is open, the
  related vendor row on `/money` and the related COI row on `/compliance`
  pick up a 6% tint. Causality is felt at the periphery, not navigated.

See [[pressure_first_product_model]].

### 6. Executable vs observable surfaces

Rows are **always read-only**. Click → drawer. The drawer holds all
mutating actions: **Assign / Status / Comment / Snooze / Escalate**.
Keyboard carries action density:

```
a → assign        s → status menu      c → comment
z → snooze        e → escalate         x → dismiss
shift+click → batch select; bottom action bar appears
```

No inline-row buttons. They create hover ambiguity, multiply chrome, and
double-encode actions that the drawer already owns. See
[[operator_attention_model]].

### 7. The product becomes more opinionated by removing surfaces

Five operator surfaces post-P9:

| Surface | Purpose |
|---|---|
| `/now` | The cockpit. Lanes of pressure. |
| `/work` | The power-lens. Saved views. Backlog. |
| `/compliance` | COI + tenant insurance + assign-gate violations. |
| `/money` | Approvals + invoices. |
| `/inbox` | Notifications, action-weighted. |

Everything else is utility CRUD living under `/admin/*`. Daily operators
never visit `/admin/*`; admins occasionally do.

---

## Surface-removal slate

| Remove | Why |
|---|---|
| `/board` | Already a redirect; prune the route |
| `/dispatcher` | Legacy; `/now` covers the dispatcher loop |
| `/work-orders` | Legacy; `/work` supersedes |
| `/dashboard` | Executive reflex; ad-hoc reporting, not daily ops |
| `/admin/approvals` | Duplicated by `/money?tab=approvals` |
| `/help`, `/subscriptions` | Placeholders |
| `/settings` bridge wrapper | Port destinations into `/admin/*` directly |
| Stat tiles wherever present | Dashboard reflex; replaced by lane-header asides |
| `/work-orders` property + priority filters | Subsumed by `/work` filters |

This is the most opinionated single decision in P9. Removing surfaces is
how the product earns its identity — every PM tool ages by accumulating
surfaces; Stack OS ages by removing them.

---

## Kanban: kept but redesigned

Drag-drop is killed (gimmick). The column shape survives on `/work?view=board`
as a **keyboard-driven status batching surface**:

- Columns still represent statuses (`new`, `triaged`, `assigned`, etc.)
- Operator presses `j/k` to move through cards inside a column
- Shift-select picks N cards
- `s` opens a status menu; chosen target transitions all selected cards
  in one server action, with `⌘Z` undo

This preserves the dispatcher's visual mental model without the
drag-drop affordance. Same outcome, faster, more accountable (every
batched transition is one audit entry per card, with a single operator
action timestamp).

---

## What P9 explicitly is NOT

- ❌ a feature sprint
- ❌ a CRUD expansion
- ❌ an analytics or dashboard layer
- ❌ an AI copilot pass
- ❌ an AppFolio replacement
- ❌ an architectural rework
- ❌ a new module count

P9 keeps every architectural choice from P0–P8 (sharded entity tables,
`app_user` role + `SET LOCAL ROLE`, magic-link identities, Inngest async,
polymorphic comments/attachments/audit). What changes is the **conceptual
framing** at the interaction layer, and the surface-removal pass.

---

## What you should feel after this lands

When the implementation phase that executes against these docs is finished,
an operator should be able to:

1. Open `/now` at 8am.
2. See — at the silhouette level, before reading any text — that two lanes
   are loud and four are quiet.
3. Click the top OVERDUE row.
4. Read the drawer's memory blocks (3rd plumbing call to this unit / vendor
   stress / sibling work / blocked by COI gap).
5. Press `a`, assign, press `esc`.
6. Repeat for the next loud row.

Total morning loop: 60–90 seconds for 8–12 decisions. No scrolling lists.
No tab-switching. No translation between "row" and "what's actually
happening."

---

## Companion docs

- [[pressure_first_product_model]] — the conceptual model
- [[cockpit_information_hierarchy]] — what the eye lands on first
- [[lane_behavior_model]] — per-lane morphology
- [[operator_attention_model]] — how attention flows through a day
- [[card_list_hybrid_exploration]] — why minimal-list, why not cards
- [[p9_execution_plan]] — sequenced stages for downstream implementation

---

## Verification

This doc is good when:

- A new contributor can read it alone and correctly answer:
  *what is the product? what are the 5 surfaces? why no cards? why no
  drag-drop? what is "pressure"?*
- Every section ties back to one of the 7 priority decisions.
- No mockups, no JSX, no schema diagrams. The doc is conceptual on purpose.
