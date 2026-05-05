# Stack OS — Workflow states

**Owners:** Schema & Backend Agent + Workflows & Jobs Agent · **Update freq:** per change

State machines are the **canonical source** in `/contracts/state-machines/*.ts`.
This file is the human-readable mirror. UI and API both import from
`/contracts`. No agent invents transitions — extend the machine, generate a
migration, file an ADR.

## work_orders

Statuses: `new`, `triaged`, `assigned`, `scheduled`, `in_progress`, `blocked`,
`resolved`, `verified`, `closed`, `cancelled`.

```
   new ──▶ triaged ──▶ assigned ──┬─▶ scheduled ──▶ in_progress ──▶ resolved ──▶ verified ──▶ closed
    │         │           │       │       │            │
    ▼         ▼           ▼       └──▶ blocked ◀───────┘
                                  cancelled (terminal)
```

Allowed transitions are encoded in `/contracts/state-machines/work-order.ts`.

Side effects (P3 wires these via Inngest):

| Transition | Side effect |
|---|---|
| `* → assigned` | Insert `assignments` row · notify assignee |
| `* → scheduled` | Update `scheduled_for` · notify assignee |
| `* → in_progress` | Set `started_at` · log audit |
| `* → resolved` | Set `completed_at` · notify staff |
| `resolved → verified` | Notify creator · trigger close-out checklist |
| `* → closed` | Lock comments to read-only · final audit |

## inspections (P4)

Statuses: `scheduled`, `in_progress`, `completed`, `reviewed`, `cancelled`.

```
scheduled ──▶ in_progress ──▶ completed ──▶ reviewed
    │              │
    └──▶ cancelled (terminal)
```

Side effect on `completed → reviewed`: convert any `inspection_findings` of
`severity=actionable` into `work_orders` (atomic).

## projects (P4)

Statuses: `planning`, `active`, `punch_list`, `closing`, `closed`, `cancelled`.

```
planning ──▶ active ──▶ punch_list ──▶ closing ──▶ closed
                ▲           │            ▲
                └──── (back) ┘────── (back)
cancelled (terminal)
```

## approvals (P6)

Statuses: `pending`, `approved`, `rejected`, `expired`.

`pending` is the only non-terminal. The Workflows agent runs a daily Inngest
sweep that flips `pending → expired` when `expires_at < now()`.
