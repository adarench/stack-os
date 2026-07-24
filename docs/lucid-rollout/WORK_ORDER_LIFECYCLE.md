# Lucid Rollout — Work-Order Lifecycle Specification

**Owner:** Schema & Backend · **Update freq:** per state-machine change · **Canonical source:** `web/src/contracts/state-machines/work-order.ts` (this doc mirrors it; do not diverge).

Requirement IDs: LIF-001..008 (see [`REQUIREMENTS_TRACKER.md`](./REQUIREMENTS_TRACKER.md)).

## Canonical states (as coded — do NOT add states from the brief)

`new · triaged · assigned · scheduled · in_progress · blocked · resolved ·
verified · closed · cancelled` (`work-order.ts:9-20`). `closed` and `cancelled`
are terminal.

Two orthogonal signals augment status (not states themselves):
- **`acknowledgedAt`** — the "Acknowledged / seen" signal: stamped when the
  *assigned* user first opens the WO (`entity-detail.ts:221-231`).
- **`blockedReason`** ∈ `waiting_tenant | waiting_vendor | other` — splits the
  single `blocked` state into the brief's "waiting on requester / vendor / parts"
  (LIF-007; currently never written — must populate).

### Reconciliation with the demo's requested states (LIF-001)
| Brief state | Canonical mapping |
|---|---|
| New | `new` (→ `triaged` on ops triage) |
| Assigned | `assigned` |
| Acknowledged | `assigned`/`in_progress` **+ `acknowledgedAt`** (signal, not a state) |
| In progress | `in_progress` |
| Waiting on requester | `blocked` + `blockedReason=waiting_tenant` |
| Waiting on vendor | `blocked` + `blockedReason=waiting_vendor` |
| Waiting on parts | `blocked` + `blockedReason=other` (or add `waiting_parts` reason — reason value, not a new state) |
| Completed | `resolved` (tech-authoritative; sets `completedAt`) |
| Confirmed fixed | `verified` (tenant confirms) |
| Reopened | `resolved`/`verified` → `in_progress` |
| Cancelled | `cancelled` (terminal) |
| Closed (ops) | `closed` (terminal) |

**Decision:** do not introduce new statuses; extend `blockedReason` values if
"waiting on parts" needs to be distinct. (LR-011 does not touch the state machine.)

## Transition map (authoritative — `work-order.ts:24-35`)

| From | Allowed → |
|---|---|
| new | triaged, cancelled |
| triaged | assigned, cancelled |
| assigned | scheduled, in_progress, blocked, cancelled |
| scheduled | in_progress, blocked, cancelled |
| in_progress | blocked, resolved, cancelled |
| blocked | assigned, scheduled, in_progress, cancelled |
| resolved | verified, in_progress *(reopen)* |
| verified | closed, in_progress *(reopen)* |
| closed | — (terminal) |
| cancelled | — (terminal) |

Enforced by `canTransition()` in the single authoritative writer
`updateWorkOrderStatus` (`work-orders.ts:239-351`, guard `:248-250`).

## Per-transition contract

| Transition | Initiating role | Prereqs | Result / timestamps | Notifications | Audit | Tenant-visible wording (`labels.ts`) | Reversible? |
|---|---|---|---|---|---|---|---|
| new → triaged | Op | — | status | — | `status_changed` | "Submitted" | via cancel only |
| new/triaged → assigned | System (auto) or Op | covering tech or fallback resolved | status + `assignments` row | `wo_assigned` → tech (email+push) | `status_changed` + assignment | "Scheduled" | yes (reassign) |
| assigned/blocked → scheduled | Op/Tech | assigned | `scheduledFor` | `wo_status` → tenant | audit | "Scheduled" | yes |
| assigned/scheduled/blocked → in_progress | Tech | assigned to actor | `startedAt` (`:255`) + `acknowledgedAt` | `wo_status` → tenant | audit | "In progress" | yes |
| * → blocked | Op/Tech | open | status + **must set `blockedReason`** (LIF-007) | `wo_blocked` → creator/tenant | audit | "Waiting on you/vendor/On hold" | yes |
| in_progress → resolved | **Tech (authoritative, LR-006)** | in_progress | `completedAt` (`:256`) + build summary (SUM-001) | `wo_status`/`wo_resolved` → tenant "Completed — please confirm"; completion email (EML-005) | audit | "Completed — please confirm" | yes (reopen) |
| resolved → verified | **Tenant** | status=resolved | status; clear "needs action" | `wo_verified` → tech "Ready to close" | `tenant_confirmed_resolved` | "Completed" | to in_progress |
| resolved/verified → in_progress *(reopen)* | Tenant | status=resolved/verified | status + **null `completedAt`** (LIF-005 fix) + insert tenant note (external) | `wo_reopened` → tech "not fixed" | `tenant_reopened` | "In progress" | — |
| verified → closed | **Op only** | status=verified | status; lock comments | — | audit | "Closed" | — (terminal) |
| * → cancelled | Op | non-terminal | status | (as configured) | audit | "Cancelled" | — (terminal) |

## Completion semantics (LR-006, LIF-003)
- The **only** completion action is the technician transition `in_progress →
  resolved`, which sets `completedAt`. **No redundant operator "complete" step.**
- Duplicate-completion prevention: `canTransition` already blocks `resolved →
  resolved`; add an explicit guard so re-submitting completion is a no-op, not a
  second `completedAt`/summary write (LIF-003).
- On resolve, assemble the **structured completion record** (SUM-001) from WO
  history and associate `after_photo` attachments (ATT-010).

## Confirm / reopen (LIF-004/005)
- `tenantConfirmResolved` (`tenant-work-orders.ts:356-395`) → `verified`.
- `tenantReopen` (`:406-458`) → `in_progress`, inserts the tenant's note as an
  **external** comment, notifies the tech. **Fix (LIF-005):** null `completedAt`
  on reopen so the WO is not "completed + in progress" simultaneously.
- Both currently bypass `canTransition` with their own status gate — acceptable,
  but LIF-002 requires routing all status writes through a shared guard.

## Assignment lifecycle (ASN-*)
- `assignments` is polymorphic with an **active-unique** partial index
  (`assignments.ts:29-31`) — one active assignee per WO. Reassignment = set
  `unassignedAt` on the old row + insert a new one; both audited (ASN-006).
- Auto-assign is config-driven (building→tech, ASN-002/LOC-006) with an org
  **fallback assignee** (ASN-003) so a WO is **never silently unassigned**
  (ASN-008). Assignment reasoning ("assigned via <building> rule" / "fallback")
  is surfaced to STACK (ASN-007).

## Cancelled & duplicate handling (LIF-006)
- `cancelled` is terminal; no exit (the `restore-fallback-wo.ts` script bypasses
  this via raw SQL — operational only, not a supported transition).
- Duplicate submissions: dedupe guidance is advisory (ops merges); MSG-008 covers
  idempotent message submission.

## Server-side enforcement checklist (LIF-002)
Route **every** status write through `updateWorkOrderStatus` (or a shared guard
that calls `canTransition`), including the raw-update paths flagged in the audit:
`assignVendor` (`work-orders.ts:420-424`), `tenantConfirmResolved`/`tenantReopen`
(`tenant-work-orders.ts:364-367,418-421`). Reconcile the duplicated client
transition table (`entity-drawer.tsx:1040-1046`) to derive from `allowedNext()`
(LIF-008).
