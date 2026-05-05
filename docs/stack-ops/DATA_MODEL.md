# Stack OS — Data model

**Owner:** Schema & Backend Agent · **Update freq:** every schema change

## Architectural decision

We **do not** use a single unified `tasks` table. We use sharded entity tables
sharing polymorphic subsystems:

- `work_orders` — work orders, ad-hoc tickets, unit-turn line items
- `inspections` (added P4) — inspection events
- `inspection_findings` (added P4) — findings from inspections; spawn work_orders
- `projects` (added P4) — containers grouping work_orders
- `task_templates` (added P3) — recurring spec; NOT a row in `work_orders`

See ADR-002 in [`DECISIONS.md`](./DECISIONS.md) for the reasoning.

## P0 entity tables

```
properties ─┬─ units
            └─ (org_id)

users           — Clerk-mirrored staff
vendors         — external service providers
vendor_users    — magic-link identities per (org, vendor, email)

work_orders ── property_id, unit_id (nullable; multi-unit via task_scopes)
            ── parent_work_order_id (self-ref, used in P4 unit turns)
```

## Shared polymorphic subsystems

All carry `(target_type, target_id)`. `target_type` is the
`polymorphic_target` enum sourced from `/contracts/polymorphic.ts`:

```
work_order, inspection, inspection_finding, project,
vendor, vendor_coi, tenant_insurance_policy,
task_template, property, unit
```

| Table | Notes |
|---|---|
| `comments` | `visibility` is `internal` | `external`. Vendors can only see/post `external`. |
| `attachments` | `kind`: before_photo, after_photo, receipt, signed_doc, coi, general. Has `ordering`. |
| `audit_log` | `actor_type` includes `system` and `inngest`. `diff` is JSONB. |
| `approvals` | Threshold-based. Polymorphic target. P6 wires the workflow. |
| `assignments` | `assignee_type`: user, vendor, vendor_user. Partial unique on active rows (`unassigned_at IS NULL`). |
| `task_scopes` | Multi-unit/multi-property linkage for any task-like target. |

## ASCII ERD (P0)

```
                     ┌────────────┐
                     │ properties │
                     └─────┬──────┘
                           │ 1..*
                     ┌─────┴──────┐
                     │   units    │
                     └─────┬──────┘
                           │ 0..*
                     ┌─────┴──────┐         ┌──────────┐
                     │work_orders │◀────────│   users  │ (created_by)
                     └─────┬──────┘         └──────────┘
            ┌──────────────┼──────────────┐
            │              │              │
   ┌────────┴───┐  ┌───────┴────┐  ┌──────┴─────┐
   │ comments   │  │ attachments│  │  audit_log │   (polymorphic via target_*)
   └────────────┘  └────────────┘  └────────────┘
            │              │              │
   ┌────────┴───┐  ┌───────┴────┐  ┌──────┴─────┐
   │ approvals  │  │ assignments│  │ task_scopes│   (polymorphic via target_*)
   └────────────┘  └────────────┘  └────────────┘

   ┌────────────┐         ┌──────────────┐
   │  vendors   │────1..* │ vendor_users │
   └────────────┘         └──────────────┘
```

## Indexes (P0)

Every entity table has `(org_id)` indexed. Hot lookups indexed:

- `work_orders (org_id, status)`, `(org_id, property_id)`, `(org_id, unit_id)`,
  `(parent_work_order_id)`, `(org_id, number)`
- `comments (target_type, target_id)`
- `attachments (target_type, target_id)`,
  `(target_type, target_id, kind, ordering)`
- `audit_log (target_type, target_id, created_at)`
- `assignments (target_type, target_id)`,
  `(assignee_type, assignee_id)`,
  partial unique on `(target_type, target_id, assignee_type, assignee_id)
  WHERE unassigned_at IS NULL`

## RLS notes

See `ARCHITECTURE.md#tenant-boundary--rls`. Every entity table has
`ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`. Two policy
shapes per table:

1. Staff org-scope policy (FOR ALL) — actor is staff/system/inngest, org_id
   matches.
2. Vendor scope policies (read/insert subset) on `vendor_users`,
   `work_orders`, `comments` (external), `attachments`.

## Naming and conventions

- Table and column names are `snake_case`.
- Primary key is always `id uuid` with `default gen_random_uuid()`.
- Every entity table has `created_at`, `updated_at`, `deleted_at` (nullable).
- External-system ids live in `external_id` for AppFolio/Yardi sync.
- Money is stored in `numeric` cents (string in TS via Drizzle).
- Booleans avoided in favor of explicit status enums.
