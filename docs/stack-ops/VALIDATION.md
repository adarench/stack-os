# Stack OS — Validation log

**Owners:** QA / Test Validator + active agents · **Update freq:** every merge

Each entry records what was validated, by whom, with what evidence. This is
the audit trail that lets us mark phases done.

Format:
```
### YYYY-MM-DD · Phase · Feature
Tested by: <name>
Tests: <names of automated tests>
Manual QA: <steps and outcome>
Screenshots: <links if UI>
Signoff: <orchestrator name>
```

---

## P0

### 2026-05-05 · P0 · Repo scaffold
- Tests: `pnpm install` clean; `pnpm typecheck` passes silently
- Manual QA: deferred — Vercel preview deploy requires human Vercel auth (see `OPEN_QUESTIONS.md` Q-001)
- Schema integration test: deferred — requires `DATABASE_URL` on a real Neon branch (Q-002)
- RLS smoke test: deferred — requires `DATABASE_URL` on a real Neon branch (Q-002)
- Signoff: code-side complete; awaiting external creds

## P1 (first push)

### 2026-05-05 · P1 · server lib + UI + tests
- Tests: 13 vitest unit tests green (8 work-order FSM + 4 token + 1 harness); 6 RLS integration tests `todo` (auto-skipped without `DATABASE_URL`)
- Typecheck: clean
- Manual QA: deferred — needs Clerk + Neon + R2 + Resend creds; Day-3 phone validation pending
- Signoff: code-side complete; awaiting external creds + Day-3 phone walkthrough

### Day-3 manual QA checklist (pending creds)
- [ ] Staff signs in via Clerk on phone
- [ ] Staff creates property + unit + vendor + invites vendor user (magic link reaches inbox or appears in dev log)
- [ ] Vendor opens magic-link URL on phone, lands on `/vendor`, sees nothing assigned
- [ ] Staff creates a work order with property + unit
- [ ] Staff assigns vendor — WO advances to `assigned`
- [ ] Vendor refreshes `/vendor`, sees the assigned WO
- [ ] Staff captures `before_photo` from phone camera; image uploads via signed URL; appears in WO grid
- [ ] Staff transitions `assigned → scheduled → in_progress → resolved → verified → closed`
- [ ] All transitions audited; cross-org RLS smoke test passes

## P2 (first push)

### 2026-05-05 · P2 · kanban board + filters + dispatcher view
- Tests: 5 new vitest unit tests green (board grouping, drop adjacency vs state machine, priority guard). Total 18 unit + 6 todo.
- Typecheck: clean
- Manual QA: deferred — needs real DATABASE_URL + a few seeded WOs to drag
- Signoff: code-side complete; awaiting external creds + Day-3 walkthrough

### Day-3 board QA checklist (pending creds)
- [ ] Open `/board` on desktop with seeded WOs across statuses
- [ ] Drag a "new" card to "triaged" → moves and persists; refresh confirms
- [ ] Drag a "new" card to "in_progress" → snap-back; error toast shows "Cannot move new → in progress"
- [ ] Switch view to "Dispatcher" → only `new` / `triaged` / `blocked` columns populated
- [ ] Filter by property → board re-renders, deep link works (paste URL into new tab)
- [ ] On phone: tap a card → opens detail. Tap "Move…" → choose next state from chip list. Persists.
- [ ] "Show closed" toggle reveals `closed` + `cancelled` columns; toggle off hides them.

## P1/P2 hardening

### 2026-05-05 · Build verification (no creds)
- `pnpm install` clean
- `pnpm typecheck` passes silently
- `pnpm build` green without `DATABASE_URL`, Clerk, R2, Resend, Twilio, Inngest envs (route groups isolate Clerk init to `(app)`; `/vendor/invalid` prerenders statically)
- `pnpm dev` boots; Clerk runs in keyless dev mode; `/api/health` returns `200 {ok:true}`; `/sign-in` and `/vendor/invalid` render `200`
- Routes registered: `/`, `/sign-in`, `/sign-up`, `/select-org`, `/work-orders`, `/work-orders/new`, `/work-orders/[id]`, `/board`, `/dispatcher`, `/admin/properties`, `/admin/vendors`, `/vendor`, `/vendor/invalid`, plus 4 API routes

### 2026-05-05 · Search + dispatcher + photo hardening
- Tests: 41 unit pass (up from 18); 6 RLS integration tests still `todo` (auto-skipped without DATABASE_URL)
  - search: 7 tests (`searchPattern` escaping + null cases, `parseWoNumber` formats + edge cases)
  - format: 5 tests (`relativeTime` minutes/hours/days/future/old)
  - dispatcher: 7 tests (`DISPATCHER_STATUSES`, `isDispatcherTab`, `sortByPriorityThenAge` urgent/age/no-mutate, `countByStatus`)
  - mobile move menu: 4 tests (FSM ↔ menu lockstep)
- Typecheck: clean
- Manual QA: gated on creds. See Day-3 checklists above. New mobile photo upload checklist below.

### Day-3 mobile photo upload checklist (pending creds)
- [ ] Pick a single 2 MB photo → progress bar fills 0% → 100%, "done" badge appears, photo shows in grid
- [ ] Pick 3 photos at once → 3 rows show with sequential progress; all land in grid
- [ ] Pick a 50 MB photo → row immediately shows "error: File too large (max 25MB)"
- [ ] Force a 403 (e.g. let signed URL expire) → row briefly errors and retries with a fresh URL; succeeds
- [ ] On iOS, pick a HEIC photo → upload accepted (Safari converts on upload via `image/*`)
- [ ] Photos render in `/work-orders/[id]` grid with signed read URLs

### What's still gated on creds (cannot run locally yet)
- ✅ ~~`pnpm db:migrate` / RLS smoke tests~~ DONE 2026-05-05 — Neon wired, 45/45 tests pass
- End-to-end staff sign-in via real Clerk org (works in keyless dev mode but not against a real org)
- Photo upload end-to-end (needs R2 bucket + access keys)
- Vendor magic-link email delivery (needs Resend domain; URL is logged to console as a fallback)
- Twilio SMS (A2P 10DLC blocker — 2-4 wk regulatory)
- Vercel preview deploy (needs `vercel link`)

### Credential-wiring sequence (in progress)
Brad pastes credentials in chat → I write to `web/.env.local` (gitignored). For each set:

1. **Neon** (`DATABASE_URL` + `DATABASE_URL_UNPOOLED`) — ✅ **DONE 2026-05-05**
   - `pnpm db:migrate` applied 0000 + RLS cleanly
   - 45/45 tests pass; 4 RLS integration tests confirm tenant isolation under the `app_user` role
   - Caught + fixed: `BYPASSRLS` on owner role would have defeated RLS — see ADR-006
2. **Clerk** (keyless mode) — ✅ **DONE 2026-05-05**
   - No keys provided; Clerk runs in keyless dev mode
   - Audit: no deprecated APIs (`<SignedIn>`/`<SignedOut>`, `authMiddleware`, `_app.tsx`, etc.)
   - Fixed: `withStaffScope` now uses Next's `redirect()` instead of throwing — 6/6 protected routes return 307→/sign-in, 3/3 public routes 200
   - Real-org sign-in still pending: needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` to validate against an actual Clerk org
3. **R2** — ✅ **DONE 2026-05-05**
   - All S3 vars wired (endpoint, region, bucket, access key id, secret access key)
   - Round-trip probe validated: HeadBucket / PutObject / signed PUT URL / signed GET URL / HTTP fetch via URL (body matches) / DeleteObject — all green
   - Photo upload via `/api/uploads/sign` is functionally ready; remaining validation is the in-browser flow (camera capture → signed PUT → attachment row → grid render), gated on a real Clerk org session
4. **Vercel** — ⏳ pending
   - Repo is ready to push (7 clean commits on main, no remote yet)
   - Brad either authenticates `gh` locally or creates a GitHub repo + pastes URL
5. **Resend** — ✅ **DONE 2026-05-05**
   - `RESEND_API_KEY` wired
   - `RESEND_FROM_EMAIL="onboarding@resend.dev"` for testing
   - Production: verify a domain in Resend dashboard, then update FROM_EMAIL
6. **Twilio** — ⏳ deferred (A2P 10DLC, 2-4 wk regulatory)
3. **R2** (`S3_ENDPOINT` + `S3_BUCKET` + `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY`)
   - Walk Day-3 photo round-trip checklist on phone + desktop
4. **Vercel link**
   - `vercel link` + push secrets, preview deploy
5. **Resend** (`RESEND_API_KEY` + verified `RESEND_FROM_EMAIL`)
   - Send a real magic-link to a vendor inbox; verify
6. **Twilio** (deferred — A2P 10DLC takes 2-4 weeks)

### Day-3 demo readiness
The codebase is demo-ready in the sense that:
- Build is green at any time, no env vars required
- Local `pnpm dev` boots cleanly with Clerk's keyless mode
- All happy-path UI surfaces exist: list (with search), board, dispatcher, detail, photo capture, comments, magic-link invite
- 41 unit tests green; FSM, search, sort, photo upload retry, and move-menu logic are pinned

What blocks "real" demo:
- Real Clerk org so sign-in is meaningful
- Real Neon DB so any data persists across requests
- Real R2 so photos round-trip
