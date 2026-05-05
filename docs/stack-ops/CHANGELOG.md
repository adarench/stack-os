# Stack OS — Changelog (feature-state)

**Owners:** all agents · **Update freq:** every PR merge

This is **not** a git diff. Each entry records a feature-state change: what
moved, what phase, what state, what was validated.

Format: `YYYY-MM-DD · Phase · Lane · Feature · State change · Validation`.

---

## Daily sync

> Top of file. Each agent appends one short line at end of their working
> session. Older entries roll into the history below.

- 2026-05-05 · orchestrator · R2 endpoint + bucket wired; Resend API key
  wired. R2 Access Key ID + Secret Access Key still needed (the cfat_
  token Brad pasted is a Cloudflare REST API token, not the S3 access
  keys). Updated `.env.example` to make this distinction obvious for
  future onboarding. Resend uses `onboarding@resend.dev` as the FROM
  address until a domain is verified. All keys persisted in
  `web/.env.local` (gitignored, confirmed not in any commit). Repo is
  ready to push to GitHub once Brad creates the remote.
- 2026-05-05 · orchestrator · Clerk validated in keyless mode. Audited
  for deprecated APIs (none). Switched `withStaffScope` to use Next's
  `redirect()` so unauthenticated requests bounce cleanly. 45/45 tests
  pass; build clean.
- 2026-05-05 · orchestrator · Neon wired and validated end-to-end. Schema
  + RLS applied on real Neon dev branch. All 45 tests pass; ADR-006 + 7
  filed.
- 2026-05-05 · orchestrator · Cred-wiring prep: initial Drizzle migration
  generated, RLS integration tests rewritten as real tests, vitest loads
  web/.env.local.
- 2026-05-05 · orchestrator · P1/P2 hardening landed: route groups (`(app)`
  with Clerk, `(vendor)` without — fixes prerender), `pnpm build` green
  without external creds, work-order search across title/description/WO-#
  with property + priority filters and richer cards, dispatcher list view
  at `/dispatcher` with priority-then-FIFO sort + inline triage/assign,
  mobile photo upload hardened (multi-file, per-file progress, 25MB cap,
  single retry on 403, error states). 41 unit tests green (up from 18).
- 2026-05-05 · orchestrator · P2 first push landed: kanban board with
  dnd-kit drag-drop between columns, optimistic updates with rollback on
  invalid transition, mobile fallback "Move…" menu inside each card,
  filters (view preset, property, priority, archived toggle), URL-driven
  state, dispatcher preset. 18 unit tests green.
- 2026-05-05 · orchestrator · P1 first push landed (server lib + actions for
  WO/properties/units/vendors/comments/attachments + signed-URL upload +
  vendor magic-link + mobile UI + admin UI + tests). 13 unit tests green;
  6 RLS integration tests `todo` (skipped without `DATABASE_URL`).

## History

### 2026-05-05 · R2 + Resend wired; GitHub push prep

- Wired · R2 · `S3_ENDPOINT`, `S3_REGION="auto"`, `S3_BUCKET="stack-os"` populated. `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` still empty — the cfat_ token Brad pasted is a Cloudflare Account API token (REST API), not the S3 access keys. Documented in `.env.example` so future onboarding doesn't confuse the two.
- Wired · Resend · `RESEND_API_KEY` populated. `RESEND_FROM_EMAIL="onboarding@resend.dev"` (Resend's universal-test sender). For production, verify a domain.
- Env state · `web/.env.local` now has 12 populated keys + 2 empty placeholders (S3 access). Gitignored at `.gitignore:10` (root) and `web/.gitignore:3` (Clerk keyless `.clerk/` dir). Confirmed via `git check-ignore` and `git log --diff-filter=A` — nothing secret has ever been committed.
- Push prep · 7 commits on `main`, working tree clean. `gh` CLI installed locally but not authenticated. Brad either runs `gh auth login` (and I create + push), or creates the repo at github.com manually and pastes the remote URL.

### 2026-05-05 · Clerk validated in keyless mode

- Wired · Clerk · No keys needed yet — Clerk's keyless dev mode auto-creates a temporary application. The "claim your keys" callout will appear in browser when Brad opens `/`. `web/.env.local` does NOT contain `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or `CLERK_SECRET_KEY`.
- Audit · Clerk · No deprecated APIs in use. No `<SignedIn>`/`<SignedOut>` (using `auth()` in server components instead, which is also valid). No `authMiddleware`. No `_app.tsx`. All Clerk imports are from `@clerk/nextjs` or `@clerk/nextjs/server`.
- Fix · Auth flow · `withStaffScope` in `web/src/lib/server/db.ts` was throwing `Error("not_authenticated")` for unauthed requests, surfacing as 500s on every protected route. Switched to Next's `redirect("/sign-in")` / `redirect("/select-org")` — `redirect()` throws `NEXT_REDIRECT` which the framework catches and returns as a 307. All protected pages now bounce cleanly without per-page boilerplate.
- Fix · Middleware · Simplified to `clerkMiddleware()` with no callback. The custom callback wasn't running in dev (still investigating why; possibly a Clerk + keyless-mode interaction), and we don't actually need it: page/lib code handles redirects at the right time, and `/api/uploads/sign` returns JSON 401 explicitly.
- Validated · Routes · 6/6 protected routes (`/`, `/work-orders`, `/board`, `/dispatcher`, `/admin/properties`, `/admin/vendors`) → 307 → `/sign-in`. 3/3 public (`/sign-in`, `/sign-up`, `/vendor/invalid`) → 200. `/api/health` → 200 JSON.
- Tests · 45/45 still pass.

### 2026-05-05 · Neon wired + RLS validated

- Wired · Neon · `web/.env.local` populated with `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct, derived by removing `-pooler` from host). `VENDOR_MAGIC_LINK_SECRET` randomly generated.
- Wired · DB · `pnpm db:migrate` applied 0000 migration + RLS policies cleanly.
- Wired · Tests · all 45 tests pass (was 41 unit + 4 todo). RLS integration tests now active: cross-org work_order isolation, missing-`app.org_id` rejection, vendor_user assigned-only SELECT, system-actor cross-org token lookup.
- **Security fix · `app_user` role** · The Neon default owner role has `BYPASSRLS`. With my original code, every app query bypassed RLS — tenant isolation was effectively off. `db/rls-policies.sql` now creates an `app_user` role (no BYPASSRLS) and grants it CRUD + sequence + execute privileges. `withScope` in `web/src/lib/server/db.ts` and the test harness both do `SET LOCAL ROLE app_user` per transaction. Default privileges are also altered so future tables auto-grant. Filed as ADR-006.
- Fix · Policies · Added `assignments_vendor_self` SELECT policy so the EXISTS subquery inside `work_orders_vendor_assigned` resolves under the vendor scope (vendors can read their own assignments).
- Fix · Scripts · `scripts/db-migrate.ts`, `db-rls-apply.ts`, `db-seed.ts` now load `/web/.env.local` explicitly (was relying on `dotenv/config` which only reads `.env`).
- Fix · Tests · `set local app.org_id = ${val}` doesn't accept parameters (Postgres parser); switched to `select set_config('app.org_id', $1, true)` everywhere.

### 2026-05-05 · Cred-wiring prep

- Prep · DB · `pnpm --filter web db:generate` → `/db/migrations/0000_slimy_mac_gargan.sql`. 12 tables, 13 enums (work_order_status, polymorphic_target, etc.), all indexes from schema. The migration is committed; running `pnpm db:migrate` once `DATABASE_URL` lands will apply it + the hand-written RLS policies in one shot.
- Prep · Tests · `/test/integration/rls.test.ts` rewritten from 6 todos into 4 real tests that exercise: cross-org work_orders isolation, missing-`app.org_id` rejection, vendor_user can SELECT only assigned WOs, and the `vendor_users_system_lookup` policy used by the magic-link verify flow. Each test uses `describe.skipIf(!DATABASE_URL_UNPOOLED ?? !DATABASE_URL)` so they auto-skip without DB and auto-run when the URL appears.
- Prep · Tests · `vitest.config.ts` `setupFiles: ["../test/setup-env.ts"]` loads `/web/.env.local` into `process.env` for every test run, so integration tests pick up credentials without shell wrappers.
- Prep · Docs · `.env.example` annotates Neon's pooled vs unpooled URLs and which to use where.

### 2026-05-05 · P1/P2 hardening

- Hardening · Build · Route groups: `(app)` wraps Clerk, `(vendor)` does not. `/vendor/invalid` and other vendor-portal pages prerender successfully without `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Sign-in/sign-up/select-org/home marked `force-dynamic` so build is green at any phase. `next.config.ts` `experimental.typedRoutes` → top-level `typedRoutes`.
- Hardening · Build · `pnpm build` is now clean without any external creds; ready for Vercel preview deploys when keys land. `pnpm dev` boots; Clerk runs in keyless dev mode.
- Hardening · Search · `/web/src/lib/server/work-orders.ts` extended: `searchPattern` (escapes `%`/`_`/`\\`, returns `null` for empty), `parseWoNumber` (matches `WO-123` / `wo-123` / `WO123` / `123`), `listWorkOrders` accepts `q`, `priority`, `propertyId`, `unitId`, `status`. `q` ILIKEs title + description and exact-matches WO-#.
- Hardening · Search UI · `/work-orders` now has a `<WoSearch>` debounced search bar (auto-submits on clear or 3+ char idle), property + priority filters, "Clear" link, result count, friendlier empty state. Cards show priority dot + property/unit context.
- Hardening · Dispatcher view · `/dispatcher` (server) + `/lib/server/dispatcher.ts` + `/components/dispatcher-row.tsx` (client). Tabs: All / New / Triaged / Blocked with live counts. `sortByPriorityThenAge` floats urgent above high above normal above low; within priority, oldest first (FIFO — don't let stuff rot). Each row has inline vendor-assign select + Triage button.
- Hardening · Mobile photo upload · `<PhotoCapture>` now accepts multiple files, shows per-file progress via `XMLHttpRequest.upload.onprogress`, enforces 25 MB max with friendly error, retries once on `403` (signed URL expired) before giving up, accepts `image/heic` / `image/heif` for iOS. Sequential uploads keep the revalidation loop stable.
- Hardening · Format · `/web/src/lib/format.ts` `relativeTime(d)` for "5m ago" / "3d ago".
- Hardening · Tests · 23 new unit tests across search/format/dispatcher/move-menu. Total **41 unit + 6 todo**. The new `mobile-move-menu` suite asserts that for every status, the touch "Move…" surface is in lockstep with the FSM (no state reachable via drag that isn't reachable via menu, and vice versa).
- Hardening · Nav · `/work-orders`, `/board`, `/dispatcher` all cross-link in their headers.
- Hardening · Imports · After moving routes into `(app)/`, server-action imports updated from `@/app/work-orders/_actions` → `@/app/(app)/work-orders/_actions`.

### 2026-05-05 · P2 (first push)

- P2 · UI · `/board` (server) · `/components/board/{kanban-board,column,card,filter-select}.tsx` (client) · created · kanban with @dnd-kit/core. Drag a card between columns; client pre-validates via `canTransition`; on drop, optimistic update + `moveWorkOrderAction` server call + rollback if rejected.
- P2 · UI · mobile drag is unreliable cross-browser, so each card carries a `<details>Move…</details>` menu listing only the legally-allowed next states. Same `moveWorkOrderAction` path. PointerSensor + TouchSensor with delay/tolerance keep tap-to-open-detail working.
- P2 · UI · filter chips: view preset (all / dispatcher / mine), property dropdown, priority dropdown, "show closed" toggle. URL-driven; deep-linkable. Dispatcher preset narrows columns to "needs dispatch" set (new + triaged + blocked).
- P2 · Backend · `/web/src/lib/server/board.ts` · `loadBoard(filters)` returns `{ byStatus, total, filters }`. Pure helpers (`groupByStatus`, `isBoardPriority`, `emptyBoard`, column constants) are testable.
- P2 · Backend · `/web/src/app/work-orders/_actions.ts` · `moveWorkOrderAction(id, to)` typed server action used by the board. Returns `{ ok }` so the client can roll back.
- P2 · Tests · 5 new vitest tests (board grouping, transition adjacency, priority guard). Total 18 unit + 6 todo. `server-only` shim added so server modules can be tested directly.
- P2 · Nav · `/work-orders` and `/board` cross-link in their headers.

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
