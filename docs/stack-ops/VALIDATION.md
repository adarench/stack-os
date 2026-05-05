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
4. **Vercel** — ✅ **DONE 2026-05-05**
   - Repo at `adarench/stack-os` (private)
   - Project at `adam-renchers-projects/stack-os` (Next.js, Node 24.x)
   - All 16 env vars synced to production + preview + development (incl. real Clerk keys)
   - **Production live: https://stack-os-omega.vercel.app**
     - `/` → 307 → `/sign-in`
     - `/sign-in` → 200 (Clerk renders)
     - `/api/health` → 200 JSON
   - Deployment Protection: **disabled** (production accessible without SSO)
   - **Known issue:** GitHub auto-deploys are currently failing with no error logs (platform-side glitch after rootDirectory toggling). Workaround: deploy via `vercel link --yes --project stack-os && vercel deploy --prod` from `/web/`. Likely fixed by re-configuring rootDirectory via Vercel dashboard.

5. **Clerk** — ✅ **REAL KEYS 2026-05-05**
   - Claimed the keyless dev app and got `pk_test_...` + `sk_test_...`
   - Synced to Vercel; production middleware now serves correctly
   - Replaced the earlier "keyless dev mode only" status
5. **Resend** — ✅ **DONE 2026-05-05**
   - `RESEND_API_KEY` wired
   - `RESEND_FROM_EMAIL="onboarding@resend.dev"` for testing
   - Production: verify a domain in Resend dashboard, then update FROM_EMAIL
6. **Twilio** — ⏳ deferred (A2P 10DLC, 2-4 wk regulatory)

---

## P2 Day-3 validation checklist

**Goal:** confirm a real user can complete a full work-order lifecycle —
creation → triage → assignment → in-progress updates → completion — across
list, board, and dispatcher views, on both desktop and mobile.

**Site:** https://stack-os-omega.vercel.app
**Pre-req:** at least one property, one unit, one vendor, one vendor_user in
the org. If empty, do the **Pre-flight setup** section first.

Mark each item ✅ pass / ❌ fail / ⏭ skip with notes. Record results in a
new dated section under "P2 (validated)" below.

### Pre-flight setup (≈5 min, desktop)
- [ ] Sign in via Clerk on desktop. After sign-up, the Clerk widget should
  prompt to create your first organization. Name it (e.g. `Stack Real
  Estate`). Expected: redirect to `/work-orders`, empty list.
- [ ] Click **Dispatch** in the header → land on `/dispatcher`. Tabs (All /
  New / Triaged / Blocked) all show count `0`.
- [ ] Click **Board** in the header → land on `/board`. Each column shows
  "Empty" placeholder. Total `0 cards`.
- [ ] Open `/admin/properties`. Create a property: name=`Cedar Ridge Apt`,
  city=`Boise`, state=`ID`. Expand it, add a unit `3B`, BR=`2`, BA=`1`.
- [ ] Open `/admin/vendors`. Create a vendor: name=`Acme Plumbing`, trade=
  `plumbing`. Expand it, invite a vendor user with your own email (or any
  inbox you can read). Expected: form clears; the new vendor user appears
  with status `invited`.
- [ ] Check the dev console / Vercel logs for `[invite] vendor_user_id=…
  url=…`. Copy that URL — it's the magic link. (Resend may also email it
  if `onboarding@resend.dev` reaches your inbox.)

### A. Creation (desktop)
- [ ] `/work-orders` → click **+ New**. Fill: title=`Leaky kitchen faucet`,
  description=`tenant reports drip overnight`, priority=`high`,
  property=`Cedar Ridge Apt`, unit=`3B`. Submit.
  - **Expected:** redirect to `/work-orders/[id]`. Header shows `WO-1`,
    status pill `NEW`, "Move forward" buttons (`→ triaged`, `→ cancelled`).
- [ ] Back to `/work-orders` list.
  - **Expected:** card shows priority dot (amber for `high`), `WO-1`,
    title, `Cedar Ridge Apt · 3B`, status pill `new`. Result count `1`.
- [ ] `/board` desktop view.
  - **Expected:** card visible in **new** column with same priority dot
    and unit context.
- [ ] `/dispatcher` All tab.
  - **Expected:** WO-1 appears at top (highest priority `high` + only
    item). "Assign vendor" select shows `Acme Plumbing — <name/email>`.

### B. Triage (mixed surfaces)
- [ ] On `/board`, **drag** WO-1 from `new` to `triaged`. Watch for: column
  glows green during hover; card snaps into the new column on drop.
  - **Expected:** instant optimistic move; no error toast; refresh
    confirms persistence.
- [ ] On the WO detail page, the audit-implied state shows `TRIAGED`. Move
  buttons now show `→ assigned`, `→ cancelled`.
- [ ] On `/board`, try to drag WO-1 from `triaged` directly to
  `in_progress`. **Failure case to watch:**
  - **Expected:** column glows **rose** during hover; on drop the card
    snaps back; rose error banner reads *"Cannot move triaged → in
    progress"*. WO-1 stays in `triaged`.
- [ ] On `/board`, drag WO-1 to `cancelled` then refresh. Use browser
  back-button. On `/board`, drag back to `triaged`. **Failure case:**
  - **Expected:** snap-back + error (cancelled is terminal). WO-1 stays
    in `cancelled`. Use the WO detail page directly via URL to verify
    "Terminal state." copy displays. (You can re-create a WO if needed.)

### C. Assignment (dispatcher view)
Re-create or move a WO back to `triaged` for this section if needed.

- [ ] `/dispatcher` → All tab. WO-1 should be visible. The vendor
  dropdown shows `Acme Plumbing — <vendor user>`.
- [ ] Select the vendor user → click **Assign**.
  - **Expected:** the row's status pill flips to `ASSIGNED` immediately
    (server-side `assignVendor` advances the state). The dispatcher list
    no longer shows it on `New` / `Triaged` / `Blocked` tabs (since it's
    no longer in the dispatch set). The "All" tab also drops it.
- [ ] Visit `/work-orders/[id]` for that WO. The "Assign vendor" section
  is still there; the new vendor row should show in the dropdown but
  the existing assignment isn't visible in this MVP UI — that's OK,
  audit_log captures it. The status pill is `ASSIGNED`.
- [ ] Use the magic-link URL from setup. Open in incognito → vendor lands
  on `/vendor`. The assigned WO should appear under "Assigned to you"
  with WO-#, title, and status pill.
  - **Failure case:** if the magic link expired or RLS misfires, vendor
    lands on `/vendor/invalid` or sees `Nothing assigned right now.`
    despite being assigned — check the console for the invite URL again
    and re-issue.

### D. In-progress updates (mobile)
Switch to your phone for this section. Use the same incognito context for
the vendor side; staff side stays signed in via Clerk.

- [ ] On phone, open `https://stack-os-omega.vercel.app/work-orders/[id]`
  signed in as staff. Layout should be max-w-md, single column.
  - **Expected:** title, priority dot, status pill, "Move forward"
    buttons all present and tappable (≥44px height).
- [ ] Tap `→ scheduled`.
  - **Expected:** state advances; no full-page reload (server action via
    transition). Status pill updates.
- [ ] Tap `→ in_progress`.
  - **Expected:** advances cleanly. `started_at` recorded server-side
    (visible if you query DB; UI doesn't show it yet).
- [ ] **Photo capture, before:** tap **Before** card. Phone camera/gallery
  opens. Take or pick a photo.
  - **Expected:** row appears under file list with progress bar
    `0% → 100%`, then "done" badge. Photo appears in 3-column grid.
- [ ] Pick **3 photos at once** via Before. (On iOS, tap Photo Library →
  multi-select.)
  - **Expected:** 3 rows queue, run sequentially, each shows progress,
    all land in grid.
- [ ] **Failure case — large file:** if you have a 25 MB+ image, picking
  it should immediately error with `File too large (max 25MB)` on that
  row, no upload attempted.
- [ ] **Comments:** type a comment in the bottom field, tap **Post**.
  - **Expected:** input clears; comment appears in thread above with
    timestamp + visibility=`internal`.
- [ ] Refresh the page on phone. All photos and comments persist; status
  pill is still `in_progress`.

### E. Vendor side (mobile)
- [ ] On phone, in incognito, open the vendor magic-link URL again.
  - **Expected:** if cookie still valid, lands on `/vendor` with the
    assigned WO. If expired (>30 day cookie), redirected to
    `/vendor/invalid`.
- [ ] Tap the WO card on `/vendor`.
  - **Expected:** in P2 the vendor portal is read-only — tapping doesn't
    navigate (this is intentional for MVP; vendor write surfaces are P3+).
    The portal lists the WO with status `IN_PROGRESS`.

### F. Completion (back to staff, desktop or mobile)
- [ ] On the WO detail page (staff session), tap `→ resolved`.
  - **Expected:** status flips to `RESOLVED`. `completed_at` recorded.
    Move-forward shows `→ verified`, `→ in_progress` (rework path).
- [ ] Tap `→ verified`.
  - **Expected:** status `VERIFIED`. Move-forward shows `→ closed`,
    `→ in_progress`.
- [ ] Tap `→ closed`.
  - **Expected:** status `CLOSED`. Section reads "Terminal state." with
    no buttons.
- [ ] On `/board`, the WO is no longer visible in default columns.
- [ ] Toggle **Show closed** on `/board`.
  - **Expected:** `closed` and `cancelled` columns appear; the WO sits
    in `closed`.

### G. Filters and search composition (desktop)
Create 2-3 more WOs across different properties/priorities to exercise this.

- [ ] `/work-orders` → type `leak` in the search bar.
  - **Expected:** filters to WOs whose title/description contains "leak"
    (case-insensitive). Result count updates.
- [ ] Combine: search `leak` + status filter `in progress` + property
  dropdown.
  - **Expected:** all three filters AND together. Clear button appears.
- [ ] Click **Clear**.
  - **Expected:** all filters reset; full list returns.
- [ ] Type `WO-1` in search.
  - **Expected:** matches the WO with that exact number.
- [ ] `/board` → switch to **Dispatcher** view chip.
  - **Expected:** columns narrow to `new` / `triaged` / `blocked` only.
- [ ] `/board` → set **property** filter to one specific property.
  - **Expected:** board re-renders with only that property's WOs.
- [ ] Copy the URL with filters applied, open in a new tab.
  - **Expected:** same filtered view loads (URL-driven state works).

### H. Mobile-specific gotchas
- [ ] **Touch drag:** on phone Safari/Chrome, long-press a card on
  `/board`. After ~200ms it should lift visually and follow your finger.
  Drop on adjacent column.
  - **Expected:** the same valid/invalid drop logic as desktop. Mobile
    drag may feel sluggish — that's why the **Move…** menu exists.
- [ ] **Move… menu:** on a card, tap **Move…**. Chip list of allowed
  next states appears.
  - **Expected:** only canTransition-allowed targets show. Tapping one
    moves the card; same optimistic update + rollback rules.
- [ ] **Tap-vs-drag conflict:** tap (don't drag) the WO title on a card.
  - **Expected:** navigates to detail page (not a misfired drag).
- [ ] **Horizontal scroll:** on `/board`, scroll columns horizontally with
  swipe. Snap-to-column behavior should hold.
- [ ] **Status pill readability:** all status pills readable at default
  zoom. Priority dots large enough to distinguish (urgent rose vs high
  amber vs normal sky vs low neutral).

### I. Cross-cutting failure cases
- [ ] Refresh the page mid-drag (during the brief moment the card is
  lifted). **Expected:** state consistent on reload (no torn UI).
- [ ] Sign out and visit `/work-orders` directly.
  - **Expected:** 307 → `/sign-in`. No 500.
- [ ] As staff, hit `/vendor`.
  - **Expected:** redirects to `/vendor/invalid` (no vendor session
    cookie). No 500. No data leak.
- [ ] Open `/api/health` in browser.
  - **Expected:** `{"ok":true,"env":"development"}` (200).
- [ ] Open the WO detail URL of a WO from a different org (if you have
  one to test).
  - **Expected:** "Not found" 404 (RLS blocks the SELECT).

### Definition of P2 complete
**P2 is complete when ALL of the following are true:**

1. Pre-flight setup, A, B, C, F, G, I sections all ✅ on desktop.
2. D, E, H sections all ✅ on a real phone (iOS Safari **and** Android
   Chrome if both available; iOS Safari minimum).
3. The full lifecycle (creation → closed) ran end-to-end with no 500
   errors and no torn UI.
4. State-machine enforcement holds: every invalid drag/menu-pick was
   rejected with a visible error and the optimistic move rolled back.
5. URL-driven filters survive paste/refresh (deep-linkable state works).
6. Vendor portal sees only WOs assigned to that specific vendor_user, not
   any other org's data.
7. Photo round-trip works: select → progress → "done" → grid → refresh
   persists.

If any item fails, file it in `OPEN_QUESTIONS.md` with `Phase: P2 -
validation` and treat P2 as not yet closed.

### P2 — Validated runs

> Append a dated entry per validation pass. Format:
> ```
> ### YYYY-MM-DD · validated by <name>
> - Desktop sections (A,B,C,F,G,I): <pass / fail items>
> - Mobile sections (D,E,H): <device — pass / fail items>
> - Lifecycle: <created → closed completion?>
> - Notes: <surprises, follow-ups>
> ```
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
