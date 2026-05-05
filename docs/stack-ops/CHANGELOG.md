# Stack OS — Changelog (feature-state)

**Owners:** all agents · **Update freq:** every PR merge

This is **not** a git diff. Each entry records a feature-state change: what
moved, what phase, what state, what was validated.

Format: `YYYY-MM-DD · Phase · Lane · Feature · State change · Validation`.

---

## Daily sync

> Top of file. Each agent appends one short line at end of their working
> session. Older entries roll into the history below.

- 2026-05-05 · orchestrator · P1 first push landed (server lib + actions for
  WO/properties/units/vendors/comments/attachments + signed-URL upload +
  vendor magic-link + mobile UI + admin UI + tests). 13 unit tests green;
  6 RLS integration tests `todo` (skipped without `DATABASE_URL`). Next:
  hook up real Neon/Clerk/R2 envs, run `pnpm db:migrate`, exercise
  end-to-end flow on a real phone (Day 3 validation).

## History

### 2026-05-05 · P1 (first push)

- P1 · Schema · `org_id` columns changed from `uuid` to `text` to hold
  Clerk org IDs (`org_2abc...`). RLS helper updated to match. Done before
  any migration ran, so no data migration needed.
- P1 · Backend · `/web/src/lib/server/db.ts` · `withScope`, `withStaffScope`,
  `withVendorScope` wrap every query in a transaction with `SET LOCAL
  app.org_id / app.actor_type / app.vendor_user_id`. RLS is the tenant
  boundary; app code never trusts itself.
- P1 · Backend · `/web/src/lib/server/{audit,sequence,sync-user}.ts` ·
  audit_log writer, per-org WO number allocator (P3 will harden with
  advisory locks), Clerk user mirror.
- P1 · Backend · `/web/src/lib/server/work-orders.ts` · create / list /
  get / updateStatus (state machine enforced) / assignVendor.
- P1 · Backend · `/web/src/lib/server/{properties,vendors,comments,attachments}.ts` ·
  CRUD + list + audit.
- P1 · Backend · `/web/src/lib/server/storage.ts` + `/api/uploads/sign` ·
  signed PUT URLs for direct browser-to-R2 uploads (15-min TTL).
- P1 · Backend · `/web/src/lib/server/{vendor-auth,vendor-invite}.ts` +
  `/api/vendor/auth/[token]` · vendor magic-link issue + verify; HMAC
  signed cookie for vendor sessions; cross-org token lookup via
  `vendor_users_system_lookup` RLS policy.
- P1 · DB · `/db/client.ts` switched from `neon-http` to
  `neon-serverless` (WebSocket Pool) so transactions are supported.
- P1 · DB · added `vendor_users_system_lookup` SELECT policy for the
  cross-org token-resolve path.
- P1 · UI · `/work-orders` mobile list with status filter chips,
  `/work-orders/new` create form, `/work-orders/[id]` detail with status
  transitions, comments, photo grid (signed read URLs), photo capture
  before/after, vendor assign dropdown.
- P1 · UI · `/admin/properties` and `/admin/vendors` admin pages — used
  for Day-3 seed validation.
- P1 · UI · `/vendor` portal landing — vendor sees their assigned WOs.
- P1 · UI · `/` redirects to `/work-orders` (or sign-in).
- P1 · Tests · vitest configured. 8 work-order FSM tests + 4 token tests
  green. RLS integration tests scaffolded (skipped without DATABASE_URL).

### 2026-05-05 · P0

- P0 · Schema · `work_orders + properties + units + users + vendors + vendor_users + comments + attachments + audit_log + approvals + assignments + task_scopes` · created · drizzle schemas land; RLS policies hand-written in `/db/rls-policies.sql`.
- P0 · Schema · `/contracts/state-machines/{work-order,inspection,project,approval}.ts` · created · canonical state machines exported. UI and API import from here.
- P0 · Infra · Repo scaffold · created · `/web` Next.js 15 + TS strict + Tailwind v4 + Clerk + PWA manifest stub.
- P0 · Workflows · `/inngest` · created · client + `healthPing` no-op + `/api/inngest` route to verify wiring.
- P0 · Docs · `/docs/stack-ops/*` · created · all 10 source-of-truth docs initialized; ADRs 001/002/003 filed.
