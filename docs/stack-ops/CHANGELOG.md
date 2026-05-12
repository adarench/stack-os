# Stack OS — Changelog (feature-state)

**Owners:** all agents · **Update freq:** every PR merge

This is **not** a git diff. Each entry records a feature-state change: what
moved, what phase, what state, what was validated.

Format: `YYYY-MM-DD · Phase · Lane · Feature · State change · Validation`.

---

## Daily sync

> Top of file. Each agent appends one short line at end of their working
> session. Older entries roll into the history below.

- 2026-05-12 · orchestrator · **Desktop demo-readiness polish** on
  `redesign/operator-shell`. Audited every surface for demo immersion;
  shipped: (1) `CutoverBanner` removed from AppShell — banner referenced
  "cutover" state with no context for a viewer; (2) `/subscriptions` and
  `/help` removed from the left rail (routes still exist for direct-URL
  but no longer surface placeholder copy); (3) Settings sub-nav trimmed
  to the three sections with real legacy bridges (Properties · Vendors ·
  Templates) — Members / Notifications / Integrations dropped along with
  their "Coming in a follow-on pass" content; (4) `EntityDrawer` footer
  no longer surfaces "Open full page" — a click during demo dropped the
  viewer into the legacy admin chrome; replaced with the WO's due-time
  chip; (5) new `<LiveIndicator />` chip (pulsing green dot · "LIVE")
  on `/now` near the Pulse strip so the polling reads as real-time;
  (6) stale dev-facing copy swept: `/inbox` footer note, `/work` empty
  state ⌘K hint. **125 / 125 tests green** post-polish. Zero schema
  changes, zero backend changes.
- 2026-05-12 · orchestrator · **P8 refinement pass · audit + highest-leverage
  fixes** on `redesign/operator-shell`. Operated the system as dispatcher /
  PM / field op / executive / stress against a seeded `org_audit_walkthrough`
  (8 properties · 30 units · 10 vendors · 39 WOs · 6 inspections · 3 projects
  · 5 pending approvals · 8 COIs · 20 notifications). Single biggest finding:
  the Overdue lane was **lying** — 4 of 11 rows were `resolved`/`verified` WOs
  awaiting closeout (not actually blocking field work), and the urgent leak
  ranked 5th because the lane sorted by `due_at ASC`. Shipped: (1) Overdue
  lane excludes `resolved`/`verified`/`closed`/`cancelled`; (2) sort by
  `priority DESC` then `due_at ASC` so urgent rises to top; (3) overdue
  inspections now surface in /now Overdue (previously invisible — 4 of 6
  seeded inspections were past `scheduled_for` and the operator never saw
  them); (4) `URG` / `HIGH` priority chip on `EntityRow` so urgent leaks
  visually dominate low-priority cabinet hinges; (5) summary count matches
  the new filter so the Pulse strip stops over-reporting. Reverted an
  attempt to filter "create-only" rows from Just Changed — it hid newly-
  filed WOs the dispatcher needs to see. **125/125 tests green** post-fix.
  Branch still uncommitted; needs human walk to validate operator feel.
- 2026-05-11 · orchestrator · **A + D bundle on `redesign/operator-shell`**:
  realistic seed (`scripts/db-seed.ts`) + sonner Toaster mounted in AppShell
  + toast-friendly approval action. 125/125 tests green.
- 2026-05-11 · orchestrator · **redesign/operator-shell big-bang** — 13-step
  Linear-style operator UI shipped behind `NEXT_PUBLIC_NEW_SHELL=1` flag.
  Top bar + left rail + bottom tab bar; ⌘K command palette (Navigate +
  Create); `/now` command center with 6 lanes (Needs you · Overdue ·
  Blocked · Today · In-flight · Just changed) + Pulse strip; `/work`
  unified surface with filter chips + view-mode toggle (list / board);
  `/work` drawer with Overview · Activity · Costs · Files tabs via
  `/api/me/entity`; `/compliance` (COIs + tenant insurance + assign-gate
  violations); `/money` (approvals + invoices + export); `/settings`
  sub-nav with legacy bridges; `/inbox` + bell badge via
  `/api/me/notifications`; AutoRefresh + InstallPrompt + OfflineIndicator;
  CutoverBanner + flag-gated redirects for 13 legacy paths. shadcn/ui
  primitives + urgency tokens. **Zero schema changes, 125/125 tests green.**
- 2026-05-08 · orchestrator · P5 + P6 + P7 first pushes all live in one
  session. P5: vendor COIs + tenant insurance + tenant magic-link portal,
  daily Inngest expiry sweep, assignVendor gate with audit-logged override.
  P6: task_costs + task_time_entries + invoices with threshold-driven
  approval routing (≤$500 auto, ≤$5K manager, >$5K owner), cost
  rollup on WO detail, /admin/approvals queue, /admin/financials. P7:
  /dashboard with WO/compliance/financials/vendor tiles, MTD cost rollup,
  CSV export endpoint. AppFolio import deferred per Brad. **All 7 phases
  now ▣ first-push complete.** 125/125 tests pass (47 new across the
  three phases). Production at https://stack-os-six.vercel.app.
- 2026-05-08 · orchestrator · P4 first push live. Inspections (mobile-
  first walkthrough flow with finding rows + photos), atomic WO spawn
  on completion (one transaction; only failed actionable/critical
  findings spawn; idempotent re-complete; severity=critical maps to
  priority=urgent), projects (CRUD + state machine + child-WO grouping
  by status). 86/86 tests pass (8 new for P4). Cross-links from
  `/work-orders` header to `/inspections` and `/projects`.
- 2026-05-07 · orchestrator · P3 first push live. Recurring work-order
  templates with hourly Inngest cron + manual "Spawn now". Notifications
  schema (notifications + notification_preferences), event-driven
  dispatch via Inngest with inline fallback when no INNGEST_EVENT_KEY,
  Resend for email, SMS stub for now. Wired emit calls into
  assignVendor (notifies vendor) + updateWorkOrderStatus
  (notifies WO creator on blocked/resolved/verified). New
  `/admin/templates` UI with create + pause/resume + spawn-now. 73/73
  tests pass (10 new: cron parsing + template spawn idempotency).
  Production deploy at https://stack-os-six.vercel.app.
- 2026-05-05 · orchestrator · P2 finished as far as automation can take
  it. Two new validation surfaces: `scripts/p2-smoke.ts` (14/14 HTTP
  smoke tests against the deployed site) and
  `test/integration/work-order-lifecycle.test.ts` (18 tests driving the
  real server functions against Neon with mocked Clerk auth). Covers
  pre-flight setup, happy-path lifecycle through all 7 transitions,
  4 invalid-transition rejections, vendor assignment + cross-org
  rejection, comments, audit_log capture, and RLS vendor scope. Total
  63/63 tests pass. Sections D/H (touch drag-drop, Move… menu, photo
  camera capture) remain human-only — code paths exist and underlying
  logic is tested, but interactive UI behavior on real devices needs
  eyes. P2 functionally complete; formal closure on a human's first
  walk-through.
- 2026-05-05 · orchestrator · Clerk keys wired; production middleware
  500 (`MIDDLEWARE_INVOCATION_FAILED: Missing publishableKey`) resolved.
  Took several rebuilds: Clerk keyless mode is dev-only and broke in
  production. Pasted real `pk_test_` / `sk_test_`, pushed all 16 envs to
  Vercel. After repeated platform-side deploy failures (CLI from /web/
  hit a stale rootDirectory state, GitHub-triggered builds errored at
  0ms with no logs), I deleted and re-created the Vercel project
  cleanly with no rootDirectory and deployed CLI from /web/. Site is
  live at https://stack-os-omega.vercel.app. Deployment Protection
  disabled. GitHub auto-deploy is currently broken (Vercel platform
  glitch — likely needs follow-up via dashboard); CLI deploy from
  /web/ works.
- 2026-05-05 · orchestrator · Vercel wired (initial). Some envs synced;
  initial Clerk-less deploy 500'd. Re-wired below with real Clerk keys.
- 2026-05-05 · orchestrator · R2 fully wired and validated. Brad's first
  paste was a `cfat_` Cloudflare user API token; the R2-specific page
  gave the proper S3 keys. Round-trip probe confirmed end-to-end.
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

### 2026-05-08 · P7 (first push)

- P7 · Lib · `/lib/server/dashboard.ts` `loadDashboard()` aggregates work-order counts by status (with derived `open` excluding closed/cancelled), overdue (`due_at < now() AND status NOT IN terminal`), 7-day windows for new + closed, vendor counts (total + active), compliance gaps (COI + tenant insurance counts by status), and financials (MTD cost via `task_costs` since month-start, invoices pending approval / approved-not-paid / paid MTD). Single round-trip per metric; everything scoped via `withStaffScope`.
- P7 · UI · `/dashboard` exec view with tile grid (open / overdue / new(7d) / closed(7d), per-status counts, compliance gaps, financials, vendor counts). Tiles colored amber/rose when counts indicate problems; click-through links to the relevant admin surface.
- P7 · UI · "Dashboard" link added to `/work-orders` header.
- P7 · CSV export · `/api/export/work-orders.csv` route streams a CSV with proper escaping (commas, quotes, newlines), `Content-Disposition` attachment, dated filename. Linked from the dashboard.
- P7 · AppFolio import · **Deferred** per Brad's earlier guidance. P0 stress-test estimated 2 weeks for the import alone; revisit when AppFolio API access is sorted.
- P7 · Tests · 2 integration tests on real Neon: `loadDashboard` returns expected counts and totals from a seeded org (3 WOs, 1 walked to closed; 2 cost rows; 1 auto-approved + 1 pending invoice); `exportWorkOrdersCsv` returns rows ordered by `number`. Total 125/125.

### 2026-05-08 · P6 (first push)

- P6 · Schema · `task_costs` (kind enum: labor/materials/fee/other; amount_cents; entered_by actor cols), `task_time_entries` (started/ended + hours_decimal + hourly_rate_cents), `invoices` (vendor_id + work_order_id nullable for batch invoices; status enum: draft/submitted/approved/paid/disputed/void; submitted/approved/paid timestamps + actor cols). RLS staff_org for all three.
- P6 · Contracts · `/contracts/financials.ts` with `COST_KINDS`, `INVOICE_STATUSES`, `canInvoiceTransition` (state machine), `approvalLevelFor(amountCents)` (≤$500 auto, ≤$5K manager, >$5K owner — defaults; per-org override deferred).
- P6 · Lib · `/lib/server/costs.ts` (addCost / addCostFromVendor / listCosts / totalForWorkOrder / costBreakdown). `/lib/server/invoices.ts` (submitInvoiceFromVendor / submitInvoiceAsStaff — both atomically insert the invoice AND a pending `approvals` row when over the auto-approve threshold; transitionInvoice with state-machine enforcement and approvedAt/paidAt actor stamping). `/lib/server/approvals.ts` (listPendingApprovals + decideApproval, audit-logged).
- P6 · UI · `/admin/approvals` queue (one-click approve/reject), `/admin/financials` (status totals row + staff invoice entry form + per-row transition buttons), `<WoCosts>` component on `/work-orders/[id]` (line items, total, inline add-cost form).
- P6 · Reuses existing `approvals` polymorphic table (target_type='vendor'); no new approval schema needed.
- P6 · Tests · 9 unit (approval thresholds; invoice state-machine adjacency; canonical sets), 7 integration (cost roundtrip + total + breakdown by kind; auto-approve at $100; manager-band $750 creates pending approval; owner-band $8K; decideApproval; submitted→approved→paid; invalid transitions rejected). Total 123 at end of P6.

### 2026-05-08 · P5 (first push)

- P5 · Schema · `vendor_cois` (policy + carrier + coverage + effective/expires + attachment_id + status), `tenant_users` (org_id + unit_id + magic-link fields; mirrors vendor_users), `tenant_insurance_policies` (per-tenant; status; uploaded_by_actor_type to distinguish staff vs tenant-portal entries). New `compliance_status` enum (active / expiring / expiring window 30d / expired / superseded).
- P5 · Contracts · `/contracts/compliance.ts` with `computeComplianceStatus` pure helper.
- P5 · Lib · `/lib/server/coi.ts` (recordCoi auto-supersedes prior active; vendorHasActiveCoi gate; runCoiExpirySweep). `/lib/server/tenant-insurance.ts` same shape, plus `recordTenantInsuranceFromPortal` for tenant-scope writes. `/lib/server/tenant-auth.ts` + `tenant-invite.ts` mirror vendor pattern (HMAC cookie session + magic-link issue/verify).
- P5 · `assignVendor` extended with COI gate. Throws `vendor_coi_missing_or_expired` unless `overrideCoi=true` (audit-logged emergency override). Existing P2 lifecycle tests updated to pass `overrideCoi: true` since their seeds don't include a COI.
- P5 · `withTenantScope` helper added; `app.tenant_user_id` session var; new `current_tenant_user_id()` SQL helper. RLS: `tenant_users_self`, `tenant_users_system_lookup`, `tenant_insurance_self`, `tenant_insurance_self_insert`, plus system_scan policies for both COI and tenant insurance to support cross-org Inngest sweeps.
- P5 · Inngest · `compliance-sweep` daily 7am UTC cron runs both COI + tenant insurance sweeps in sequence; idempotent.
- P5 · UI · `/admin/compliance/cois` (record + list with status pills), `/admin/compliance/tenants` (invite + record + list), `/tenant` portal page (mobile-friendly insurance status + add-policy form), `/tenant/invalid`, `/api/tenant/auth/[token]`. (vendor) route group already bypasses Clerk; tenant pages slot in there.
- P5 · Tests · 7 unit (computeComplianceStatus across all branches + 30d window boundary), 11 integration (COI lifecycle + supersede; vendorHasActiveCoi; assignVendor blocks expired; override succeeds + audit; sweep transitions; tenant invite + magic-link consume + supersede + sweep + tenant-portal record). Total 105 at end of P5.

### 2026-05-08 · P4 (first push)

- P4 · Schema · `inspections` (kind/status/property/unit/inspector/notes plus scheduled_for/started_at/completed_at/reviewed_at), `inspection_findings` (area/description/severity/pass/spawned_work_order_id), `projects` (kind/status/property/unit/budget/target/gc/parent_project_id/closed_at). New `finding_severity` enum (info/observation/actionable/critical). `work_orders` extended with `project_id`, `spawned_from_inspection_id`, `spawned_from_finding_id`. RLS staff_org policies cover all three new tables.
- P4 · Lib · `/lib/server/inspections.ts`: createInspection / addFinding (auto-transitions scheduled→in_progress on first finding) / updateFinding / removeFinding / list / get / **completeInspection (the load-bearing piece: one withScope transaction that transitions inspection to completed AND inserts one work_orders row per failed actionable/critical finding, links each finding back via spawned_work_order_id, writes audit_log entries for each, all atomic; idempotent on re-call returning the same set)** / reviewInspection.
- P4 · Lib · `/lib/server/projects.ts`: createProject / list / get / listProjectWorkOrders / updateProjectStatus (state machine) / attachWorkOrderToProject. Closed transition stamps `closed_at`.
- P4 · Contracts · `/contracts/finding-severity.ts` with pure helper `shouldSpawnWorkOrder({ severity, pass })`. Pass=true never spawns; only actionable/critical with pass=false spawn. Severity=critical maps WO priority=urgent on spawn.
- P4 · UI · `/inspections` list with status filter chips, `/inspections/new` with kind/property/unit picker + notes, `/inspections/[id]` mobile-first with finding cards (severity badge, area, description, pass/fail toggle), inline add-finding form, complete button (shows count of WOs that will spawn), review button after completion. Finding rows link to spawned WOs.
- P4 · UI · `/projects` list, `/projects/new` form, `/projects/[id]` detail with state-machine transition buttons and child-WO grouping by status. Cross-links from `/work-orders` header to both `/inspections` and `/projects`.
- P4 · Tests · 8 new (3 unit on `shouldSpawnWorkOrder`, 5 integration: scheduled→in_progress on first finding, atomic spawn count 5→3 with 2 urgents, idempotent re-complete, locked-after-complete, completed→reviewed; 4 project tests for lifecycle + invalid transitions + WO attachment). Total **86/86 pass**.
- P4 · Build fix · Removed re-exports of contract constants from `/inspections/_actions.ts` — `"use server"` files can only export async functions.

### 2026-05-07 · P3 (first push)

- P3 · Schema · `task_templates` (cron spec + defaults + spawn state) and `task_template_fires` (idempotency audit). `notifications` (recipient_user_id OR recipient_vendor_user_id; channel: email/sms/push/in_app; status). `notification_preferences` (per-recipient per-channel toggle). RLS policies: standard staff_org for all four; new `task_templates_system_scan` SELECT policy lets the Inngest cron read across orgs (mirrors the vendor_users_system_lookup pattern from P1).
- P3 · Lib · `/lib/server/templates.ts`: `createTemplate` (cron-parser validation + computed `nextFireAt`), `listTemplates`, `setTemplateActive`, `spawnTemplateNow` (manual), `runDueTemplates` (used by Inngest), `listTemplateFires`. Idempotent spawn via dedupe on `(template_id, fire_at)`.
- P3 · Lib · `/lib/server/notifications.ts`: `emitNotification` (sends an Inngest event when `INNGEST_EVENT_KEY` is set, falls back to inline `dispatchInline` otherwise), `enabledChannels` (reads prefs with sensible defaults: email + in_app on, sms + push off), `recordNotification` + `markNotificationStatus`. Notification failure never blocks the user-driven action.
- P3 · Inngest · Replaced `healthPing` no-op with two real functions: `spawn-from-templates` (cron `0 * * * *`, calls `runDueTemplates`) and `dispatch-notification` (event-triggered on `stack-os/notification.emit`, calls `dispatchInline`).
- P3 · Wired emits · `assignVendor` now emits `wo_assigned` to the vendor user (with their email + phone). `updateWorkOrderStatus` emits `wo_blocked`/`wo_resolved`/`wo_verified` to the WO creator (in_app channel — staff email lookup deferred to P5).
- P3 · UI · `/admin/templates` page with create form (cron, timezone, default title/description/priority/property/unit, lead-time hours), pause/resume, spawn-now, fire history. `Templates` link added to `/work-orders` header.
- P3 · Tests · 10 new tests: 4 cron-parsing (`isValidCron` + `nextFireTime`), 6 template-spawn integration (creates with valid cron + computed nextFireAt; rejects invalid cron; spawnTemplateNow advances state + creates WO + records fire row; paused template skips; same `fire_at` is idempotent). Total 73/73 pass.
- P3 · Perf · `withScope` already collapsed SET LOCAL preamble to a single round-trip in P2 hardening; that carries over so each template-spawn transaction stays cheap.
- P3 · Open follow-up · Real cron firing requires `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` env vars. Without them, manual "Spawn now" works (it calls `spawnTemplateNow` directly, no Inngest). The `/api/inngest` endpoint returns 401 to unsigned requests, which is correct.

### 2026-05-05 · GitHub + Vercel wired

- Wired · GitHub · Repo `adarench/stack-os` (private) created via `gh repo create`. 11 commits pushed.
- Wired · Vercel · Project `adam-renchers-projects/stack-os` linked. All 12 env vars synced to production + preview + development via `scripts/push-vercel-env.sh` (FD-3 trick to avoid `vercel env` consuming the file's stdin; explicit empty git-branch arg for Preview).
- Wired · Vercel · `rootDirectory=web` set via PATCH `/v9/projects/{id}` (CLI doesn't expose this setting). GitHub integration connected; future pushes to `main` auto-deploy.
- Wired · Vercel · Production live at https://stack-os-six.vercel.app and https://stack-os-adam-renchers-projects.vercel.app. Preview URLs sit behind Vercel Deployment Protection (SSO required).
- Refactor · Layout · Moved `/contracts`, `/db`, `/inngest` into `/web/src/`. Original split was for agent file-ownership clarity at the repo level; same clarity is preserved at `/web/src/{contracts,db,inngest}/` and the build now ships cleanly. tsconfig paths, vitest aliases, drizzle.config, and migration scripts updated. 45/45 tests still pass.

### 2026-05-05 · R2 fully wired (round-trip validated)

- Wired · R2 · All 5 S3 vars populated: endpoint, region, bucket, access key id, secret access key. Smoke test (one-shot probe script, then deleted) ran HeadBucket / PutObject / signed PUT URL / signed GET URL / HTTP fetch via signed URL (body matches) / DeleteObject — all green.
- Note · Two Cloudflare token pages confused the flow. **User API Tokens** (My Profile → API Tokens) issues a `cfat_` token for `api.cloudflare.com/client/v4` REST calls. **R2 API Tokens** (R2 → Manage R2 API Tokens) issues `cfut_` + Access Key ID + Secret Access Key for the S3-compatible endpoint. Only the second flow gives the S3 credentials our `@aws-sdk/client-s3` client needs.

### 2026-05-05 · R2 endpoint + Resend wired (partial)

- Wired · R2 · `S3_ENDPOINT`, `S3_REGION="auto"`, `S3_BUCKET="stack-os"` populated. `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` still empty (resolved later same day).
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
