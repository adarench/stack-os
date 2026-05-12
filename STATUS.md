# Stack OS — current state

**Updated:** 2026-05-12 (demo-ready pass) · **Live:** https://stack-os-six.vercel.app · **Repo:** https://github.com/adarench/stack-os · **Active branch:** `redesign/operator-shell`

---

## Founder walkthrough — recommended desktop flow

Run with `NEXT_PUBLIC_NEW_SHELL=1` and a seeded org. Use the audit org or
your own:
```
pnpm --filter web db:seed org_audit_walkthrough     # or org_2YOUR_ORG_ID
```

| # | Surface | What to do | What lands |
|---|---|---|---|
| 1 | `/now` | Land here after sign-in. | Pulse strip across the top (35 open · 7 overdue · 3 COIs expiring · 5 approvals pending). "LIVE" chip top-right. Six lanes underneath; Overdue is at the top with WO-1001 (urgent bathroom leak) as row 1 + a red `URG` chip. |
| 2 | `/now` | Click WO-1001 row. | Drawer slides in from the right. Overview tab shows description, property, status, due. Activity tab shows audit timeline. |
| 3 | `/now` | Press `Esc`. | Drawer closes, scroll position preserved. |
| 4 | anywhere | Press `⌘K`. | Palette opens. Type `g c` → highlight "Go to Compliance · COIs expiring". Hit `⏎`. |
| 5 | `/compliance` | Look at the top. | "Assign-gate violations" lane shows the 3 vendors blocked from new WOs (no active COI). Below: COI list with Greenleaf expired at the bottom in red. |
| 6 | rail → Money | Approve the $5,400 hallway repaint. | Toast: `Approved · $5,400.00`. |
| 7 | rail → Now | Watch the Pulse strip. | "Approvals pending" decrements (4 instead of 5) next time `/now` re-renders. |
| 8 | rail → Work | Click the `Overdue` chip. | List filters to overdue-only. Toggle the `Board` view-mode toggle — kanban appears with drag-drop. |
| 9 | rail → Now | Close the loop. | Operator console. |

Notes:
- The drawer is read-only in this build — Assign / Status → / Comment are
  next-pass work. Don't promise drawer-native actions during the demo.
- The first time a user signs in, the inbox is empty (notifications need
  a recipient user id). Re-run the seed after first sign-in to attach
  notifications.



Internal Maintenance + Compliance Operating System for Stack Real Estate. Replaces day-to-day Trello + AppFolio maintenance workflow. Mobile-first PWA. Not a rebuild of AppFolio. Not an accounting system.

---

## Where we are — P8 refinement (not P9 features)

P0–P7 all shipped first-push. The redesign branch `redesign/operator-shell` then
delivered the full operator-shell rebuild behind `NEXT_PUBLIC_NEW_SHELL=1`:
top bar + rail + bottom tab bar, ⌘K, six-lane /now, unified /work, /compliance,
/money, /settings, /inbox, drawer with tabs, polling, toasts. Seed script at
real Stack scale.

**The current focus is workflow validation + refinement, not features.** A
ruthless audit pass (2026-05-12) walked the system as dispatcher / PM / field op
/ executive against a seeded org and identified that the Overdue lane was
misleading (4 of 11 rows were false positives, urgent leak sat 5 rows down).
Shipped:

- Overdue lane excludes `resolved`/`verified`/`closed`/`cancelled`
- Sort by priority DESC → due_at ASC
- Overdue inspections now visible in /now
- `URG` / `HIGH` priority chips on `EntityRow`
- Pulse strip count matches the new lane

Backend untouched. 125/125 tests green.

| Phase | What | State |
|---|---|---|
| **P0–P7** | Foundational ops platform (WO + inspections + compliance + costs + approvals + dashboard) | ■ done |
| **Redesign** | Operator-shell rebuild on `redesign/operator-shell` behind flag | ■ shipped, awaits human walk |
| **P8** | Refinement pass · audit + highest-leverage fixes | ▣ in progress |

---

## What's left for the current cycle

Carried from the 2026-05-12 audit (in leverage order):

1. **Real drawer footer actions** — Assign · Status → · Comment. Right now
   the drawer is a read-only preview; you have to bounce to legacy to act.
2. **⌘K entity typeahead** — typing `WO-1001` should open the drawer. Search
   group is reserved but unwired.
3. **Owner / vendor name on rows** — `assignments` join. Two-query touch.
   "Who's on it?" is currently unanswered everywhere.
4. **Mobile bottom-sheet drawer + working "More" tab.**
5. **Settings sub-page port** — kill the bridge to legacy chrome.

Plus the original infra carry-forward:

- Inngest prod keys (when convenient — 5 min).
- Resend domain verification (when going to real users).
- Twilio A2P 10DLC (regulatory; 2-4 wk clock).
- AppFolio import (deferred per Brad).

---

## Where we *were* — for context

All seven phases shipped first-push and deployed:

| Phase | What | State |
|---|---|---|
| **P0** | Source-of-truth docs + scaffold + auth + db + RLS + Inngest wiring | ■ done |
| **P1** | Work orders + vendors + comments + attachments + mobile shell + vendor magic-link | ▣ shipped, awaits human walk |
| **P2** | Kanban board + dispatcher + filters + search | ▣ shipped, awaits human walk |
| **P3** | Recurring task templates + notification dispatch (Inngest) | ▣ shipped |
| **P4** | Inspections + atomic spawn-on-complete + projects | ▣ shipped |
| **P5** | Vendor COIs + tenant insurance + tenant portal + assign gate | ▣ shipped |
| **P6** | Costs + invoices + threshold-driven approvals | ▣ shipped |
| **P7** | Operating dashboard + CSV export (AppFolio import deferred) | ▣ shipped |

**Tests:** 125/125 pass — 41 unit + 14 production HTTP smoke + 70 integration against real Neon (mocked Clerk auth).
**Stack:** Next.js 15 App Router · TS strict · Neon Postgres · Drizzle · Clerk · Cloudflare R2 · Inngest · Resend · Vercel.

---

## Live URLs

- **Production:** https://stack-os-six.vercel.app
- **Dashboard (sign-in required):** /dashboard
- **Vendor portal:** /vendor (magic-link from /admin/vendors → invite)
- **Tenant portal:** /tenant (magic-link from /admin/compliance/tenants → invite)
- **Health probe (public):** /api/health → `{"ok":true}`
- **CSV export:** /api/export/work-orders.csv

---

## Routes shipped (full surface area)

```
/                          307 → /sign-in
/sign-in                   Clerk widget
/sign-up                   Clerk widget
/select-org                Clerk org picker
/work-orders               list + search + filters
/work-orders/new           create form
/work-orders/[id]          detail · status · comments · photos · costs
/board                     Trello kanban + drag-drop + Move… menu
/dispatcher                priority+FIFO list + inline assign
/inspections               list + filters
/inspections/new           create
/inspections/[id]          mobile-first findings flow
/projects                  list + filters
/projects/new              create
/projects/[id]             detail · child-WO grouping · state machine
/dashboard                 exec view · WOs · compliance · financials · vendors
/admin/properties          properties + units management
/admin/vendors             vendors + vendor-user invites
/admin/templates           recurring task templates
/admin/compliance/cois     vendor COI list + record
/admin/compliance/tenants  tenant insurance + invite
/admin/approvals           pending approval queue
/admin/financials          invoice list + status totals + entry
/vendor                    vendor portal (assigned WOs)
/tenant                    tenant portal (insurance status + add)
/api/health                200 JSON
/api/uploads/sign          presigned R2 PUT
/api/inngest               Inngest webhook (signed)
/api/vendor/auth/[token]   vendor magic-link consume
/api/tenant/auth/[token]   tenant magic-link consume
/api/export/work-orders.csv  CSV download
```

---

## What's NOT done (the actual blockers)

### 1. Real-user walkthrough
**The biggest gap.** 125 tests cover data + state-machine + RLS, but only your eyes catch UX feel. You haven't done a single end-to-end walk on a real phone yet.

**Action:** open https://stack-os-six.vercel.app on your phone and follow `docs/stack-ops/VALIDATION.md` Day-3 checklist.

### 2. Inngest production keys (5 min when ready)
`spawn-from-templates` (hourly cron) and `compliance-sweep` (daily cron) are deployed but won't fire automatically without `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY`. "Spawn now" buttons work without them.

**Action:** sign up at https://www.inngest.com → create app → paste two keys → I push to Vercel envs.

### 3. Twilio A2P 10DLC (deferred — regulatory)
SMS notifications are stubbed (`console.log` only). Email + in-app channels work via Resend. A2P 10DLC takes 2-4 wk; file it whenever and we swap one stub for real Twilio sends.

### 4. AppFolio import (deferred indefinitely)
Per your earlier guidance — Stack OS owns WOs/inspections/templates/COIs; AppFolio sync is a multi-week effort and not on the critical path. P7 dashboard works on Stack OS data alone.

### 5. Resend domain verification (when going to real users)
Currently using `onboarding@resend.dev` (works but obviously a Resend test address). For real magic-link emails to vendors/tenants, verify a sending domain in Resend dashboard and update `RESEND_FROM_EMAIL`.

---

## Recommended next steps in order

1. **Open the app on your phone, sign up, walk it.** Catch what feels wrong; tell me and I fix.
2. **Wire Inngest prod keys** when convenient (5 min) — recurring/sweeps actually fire.
3. **Onboard real users** — invite a real vendor + tenant, do one real magic-link round-trip.
4. **Verify Resend sending domain** when you're ready for real email delivery.
5. **File Twilio A2P 10DLC** at any time — 2-4 wk regulatory clock.

After real users land:

6. **Polish based on actual usage feedback.** Don't pre-optimize.
7. **AppFolio bridge** — only when real adoption forces the conversation.

---

## How to pick up where I left off

```bash
git clone git@github.com:adarench/stack-os.git
cd stack-os
nvm use                                    # Node 22.22.1
pnpm install
# web/.env.local stays on Brad's laptop (gitignored). Re-paste creds
# from your password manager or pull from Vercel:
cd web && vercel env pull .env.local       # downloads all 18 envs
pnpm dev                                   # http://localhost:3000

# Tests
pnpm test                                  # 125/125 pass on real Neon
pnpm typecheck
pnpm build                                 # green without any creds

# Deploy
cd web && vercel deploy --prod             # pushes to stack-os-six.vercel.app
# (also: git push to main triggers GitHub auto-deploy when the project's
#  Vercel webhook fires; manual CLI deploy is the reliable path.)
```

---

## Source-of-truth docs

Everything detailed lives in `docs/stack-ops/`. Skim these in this order:

1. **[`README.md`](docs/stack-ops/README.md)** — entry point, mission, discipline rules
2. **[`ROADMAP.md`](docs/stack-ops/ROADMAP.md)** — phase table + concrete P4-P7 plans
3. **[`ARCHITECTURE.md`](docs/stack-ops/ARCHITECTURE.md)** — stack, deploy, RLS, identity
4. **[`DATA_MODEL.md`](docs/stack-ops/DATA_MODEL.md)** — tables, polymorphism, ERD
5. **[`WORKFLOW_STATES.md`](docs/stack-ops/WORKFLOW_STATES.md)** — state machines per entity
6. **[`DECISIONS.md`](docs/stack-ops/DECISIONS.md)** — ADRs (ADR-006 the load-bearing one)
7. **[`CHANGELOG.md`](docs/stack-ops/CHANGELOG.md)** — feature-state log per phase
8. **[`VALIDATION.md`](docs/stack-ops/VALIDATION.md)** — Day-3 walkthrough checklists
9. **[`OPEN_QUESTIONS.md`](docs/stack-ops/OPEN_QUESTIONS.md)** — unresolved blockers
10. **[`AGENT_LANES.md`](docs/stack-ops/AGENT_LANES.md)** — when running multiple agents

---

## Architectural decisions to NOT relitigate

These cost real time to figure out; don't undo without strong reason:

- **ADR-002:** sharded entity tables (`work_orders`, `inspections`, `projects`, `task_templates`) — NOT a unified `tasks` table.
- **ADR-003:** vendors and tenants are separate magic-link identities — NOT Clerk org members.
- **ADR-004:** `org_id` is text (Clerk format `org_2abc...`) — NOT uuid.
- **ADR-005:** narrow `*_system_lookup` / `*_system_scan` policies for trusted cross-org reads (magic-link verify, Inngest sweeps).
- **ADR-006:** app code uses `app_user` Postgres role (NOLOGIN, no BYPASSRLS) via `SET LOCAL ROLE` per transaction. Without this, RLS is silently bypassed on Neon.

---

## Credentials state (in `web/.env.local`, gitignored)

| Service | Status |
|---|---|
| Neon `DATABASE_URL` + `DATABASE_URL_UNPOOLED` | ✅ wired |
| Clerk `pk_test_` + `sk_test_` | ✅ wired (real keys) |
| R2 `S3_*` | ✅ wired (round-trip validated) |
| Resend `RESEND_API_KEY` | ✅ wired (using `onboarding@resend.dev`) |
| Vercel project link | ✅ `adam-renchers-projects/stack-os` |
| `VENDOR_MAGIC_LINK_SECRET` | ✅ random 32-byte, also used for tenant cookies |
| `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` | ❌ pending |
| Twilio | ❌ deferred (A2P 10DLC) |

All keys also synced to Vercel for production + preview + development. Pull locally with `vercel env pull web/.env.local`.

---

## When you sit down again

```
1. Open https://stack-os-six.vercel.app on your phone.
2. Sign up. Create an org.
3. Walk this loop:
   /admin/properties → create property + unit
   /admin/vendors → create vendor + invite vendor-user
   /work-orders/new → create WO
   /board → drag through statuses
   /work-orders/[id] → photos + comments + costs
   /admin/compliance/cois → record a COI
   /inspections/new → walk an inspection with findings → complete
   /admin/templates → create a recurring template + spawn now
   /dashboard → see the rollups
4. Tell me what's wrong.
```
