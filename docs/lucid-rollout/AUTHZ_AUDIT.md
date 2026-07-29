# Server-Side Authorization Audit

**Owner:** Stack OS · **Status:** verified · **Date:** 2026-07-29

Every sensitive read/write is enforced **on the server**, independent of what the
UI hides. Two layers: **RLS** (Postgres row-level security, the backbone) + a
**role check** on privileged mutations. Nothing relies on client-side role logic.

## Enforcement backbone — RLS (`db/rls-policies.sql`)

All 30+ tables have RLS **ENABLED + FORCED**; the app connects as `app_user`
(NOLOGIN, **no BYPASSRLS**), and every request runs inside `withScope` /
`withStaffScope` / `withTenantScope` / `withVendorScope` which `SET LOCAL ROLE
app_user` + `app.actor_type` + `app.org_id`. A missing/wrong scope therefore sees
**nothing**, not everything.

| Actor | Sees | Policy |
|---|---|---|
| Tenant | Only their **own unit's** work orders, external comments, attachments | `work_orders_tenant_self`, `comments_tenant_*`, `tenant_users_self` |
| Vendor | Only work orders **assigned to them**; external comments only | `work_orders_vendor_assigned`, `comments_vendor_*` |
| Staff/operator | Their **org's** data | `%_staff_org` (org match + actor ∈ user/system/inngest) |
| System (server) | Trusted server-only lookups (login/reset by token) | `*_system_lookup`, `rate_limits_system`, `auth_events_access` |

Verified by tests: `rls.test.ts`, `tenant-rls.test.ts`, `at-canonical` (cross-org
+ same-org tenant isolation), `auth-matrix` (#9), `m9-vendor` (vendor write block).

## Per-surface checks

| Surface | AuthN | AuthZ (server) |
|---|---|---|
| **Tenant pages** (`/tenant/*`) | `readTenantSession()` → redirect to sign-in | RLS to own unit; internal notes never selected (`loadTenantMessages` filters `external`; completion shows tenant-safe fields only) |
| **Technician** (`/tech/*`, `/api/tech/uploads`) | `auth()` (staff session) | `requireMyWo` / `resolveMyWo` — every read/write is guarded by "assigned to me"; complete reuses the authoritative writer |
| **Operator console** (`(app)/*`) | `auth()` in `(app)/layout` → redirect | `withStaffScope` (org RLS); the state machine + `updateWorkOrderStatus` are the authoritative writers |
| **Admin actions** (add person, activate/deactivate, reset, assign-tech, reassign-unit) | `auth()` | **explicit `isOperatorRole(role)` gate** in each action (`admin/_actions.ts`) — provisioning/status/reset run under system scope, so the role is checked in code |
| **Uploads** (`/api/tenant/uploads`, `/api/tech/uploads`) | session | tenant: `tenantOwnsWorkOrder`; tech: `techAttachPhoto` → `requireMyWo` |
| **Login / reset** | pre-auth | rate-limited per IP + email; generic no-disclosure errors; per-account lockout |

## Tenant may-not (confirmed blocked)
Other tenants' requests/messages (RLS) · internal operational notes (visibility
filter) · portfolio/admin/financial data (no staff scope) · assigning techs /
changing workflow (operator-gated actions). Confirmed by `at-canonical` +
`auth-matrix` + the tenant loaders selecting only tenant-safe fields.

## Technician may-not
Unrelated tenants' data (only assignment-scoped reads) · account admin / portfolio
config (operator role required) · financial approvals (approvals are operator).

## Findings
No client-only authorization found on sensitive mutations. All admin mutations
self-gate on role; all data access flows through RLS scopes. Two org-agnostic
system SELECT policies (`users_system_lookup`, `tenant_users_system_lookup`) are
used **only** by trusted server code for login/reset-by-token and filter by
token/email — not exposed to any actor.
