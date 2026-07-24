# Lucid Rollout — Current-State Gap Assessment

**Owner:** engineering · **Update freq:** as implementation state changes · **Companion to** [`REQUIREMENTS_TRACKER.md`](./REQUIREMENTS_TRACKER.md).

Every gap is evidence-cited (`file:line`) and classified. **Nothing is marked
complete from a component name or comment** — only from code read directly during
the 2026-07-23 audit. Roles: `T`=tenant, `Tech`=technician, `Op`=operator/admin,
`Sys`=system/infra.

Classification: `Complete&Verified · Built-Unverified · Partial · Present-but-
Defective · Not-Implemented · Blocked`. This document separates **(A) verified
defects** from **(B) missing capabilities** from **(C) partial/hardening** from
**(D) complete** from **(E) unverified/blocked assumptions**.

---

## A. Verified defects (code read; behavior confirmed wrong)

### ASN-001 — Tenant-submitted WOs are never assigned · **P0** · role T/Op/Tech
- **Evidence:** `createWorkOrderFromTenant` sets `status:"new"` and uses
  `scope.coveringUserId` only to send a notification — no `assignments` insert
  (`web/src/lib/server/tenant-work-orders.ts:71,88-96`). Staff path *does* insert
  (`work-orders.ts:76-127`).
- **Gap:** every resident request lands ownerless; `acknowledgedAt` can never be
  set (`entity-detail.ts:221-231` only stamps for the assigned user); WO stuck in
  the ops "attention" lens; `ownerName` null (`work-list.ts:277`). The stated
  invariant "work is never unassigned" (`work-list.ts:144-145`) is false.
- **Dependency:** none to fix minimally (reuse `coveringUserId`); full routing
  needs LOC-006/ASN-003.
- **Recommended action:** when `coveringUserId` exists, set `status:"assigned"` +
  insert `assignments{assigneeType:"user", assigneeId:coveringUserId}` + audit,
  mirroring the staff path. Add org fallback assignee (ASN-003) so no covering
  tech ⇒ still assigned or explicitly queued.
- **Validation:** integration test — tenant submit on a building with a covering
  tech ⇒ `assignments` row + `status=assigned` + audit; ops list shows owner;
  tech sees it in "mine".

### MSG-001 — Ops→resident replies default to `internal` and are invisible · **P0** · role T/Op
- **Evidence:** default `internal` at every layer — `createCommentInput` default
  `comments.ts:17`; drawer composer state `entity-drawer.tsx:1136-1138`;
  hard-coded `visibility:"internal"` `lib/actions/work-orders.ts:94`. Tenant read
  hard-filters `external` (`tenant-work-orders.ts:216` + RLS
  `rls-policies.sql:306-317`). Only `external` comments stamp `tenantUpdatedAt` +
  notify (`comments.ts:42-93`).
- **Gap:** a STACK/tech reply without manually toggling "external" never reaches
  the resident, doesn't notify, doesn't update the "tenant updated" lens. This is
  the demo symptom (LR-007).
- **Recommended action:** give the operator/tech a dedicated **"Reply to
  requester"** affordance that posts `external` by default on tenant-reported WOs
  (keep a separate "Internal note"); relabel audience clearly (not "with vendor"
  `entity-drawer.tsx:1084`). Do not change the internal-note default for
  non-tenant WOs.
- **Validation:** MSG-009 boundary test — operator reply on a tenant WO is visible
  to that tenant, stamps `tenantUpdatedAt`, fires `wo_message`; an internal note is
  NOT visible to the tenant.

### MSG-010 — `createTenantComment` doesn't stamp `tenantUpdatedAt` · **P1** · role T/Op
- **Evidence:** `tenant-work-orders.ts:234-310` inserts the tenant message but
  (unlike staff `createComment` `comments.ts:43-48`) never sets `tenantUpdatedAt`.
- **Gap:** inbound tenant messages don't clear the ops "tenant not updated" lens
  (`work-list.ts:211-214`).
- **Action:** stamp `tenantUpdatedAt` on tenant message insert. **Validation:**
  unit/integration — tenant reply updates the WO timestamp + ops lens.

### EML-004 — Staff status-change notifications never email · **P1** · role Op/Tech
- **Evidence:** the status-transition notification passes `recipientEmail` null by
  design (`work-orders.ts:315-317`) ⇒ in-app only.
- **Gap:** operators/techs get no email on blocked/resolved/verified.
- **Action:** pass the recipient email; respect preferences. **Validation:** EML
  test — transition emits an email row that sends via Resend (stub asserts in CI).

### EML-009 — Notification double-send risk on Inngest retry · **P1** · role Sys
- **Evidence:** whole dispatch wrapped in one `step.run` with no idempotency key
  (`dispatch-notification.ts:42`); `emitNotification` also falls back to inline
  dispatch and swallows errors (`notifications.ts:186-208`).
- **Action:** idempotency key per (notification row, channel); make send
  idempotent; don't double-path. **Validation:** simulate retry ⇒ single send.

### LIF-005 — Reopen keeps stale `completedAt` · **P1** · role T
- **Evidence:** `tenantReopen` sets `in_progress` but doesn't clear `completedAt`
  (`tenant-work-orders.ts:418-421`).
- **Action:** null `completedAt` on reopen. **Validation:** reopen ⇒ `completedAt`
  is null; completion summary reflects reopened state.

### LIF-008 — Duplicated client transition table drifts from contract · **P1** · role Op
- **Evidence:** drawer hard-codes a second transition table
  (`entity-drawer.tsx:1040-1046`) omitting `blocked`/`cancel`, not derived from
  `contracts/state-machines/work-order.ts`.
- **Action:** derive UI transitions from `allowedNext()`. **Validation:** unit —
  UI options equal contract for every state.

### PWA-001 — Manifest has no icons; app is not installable · **P0 (launch gate)** · role T/Tech
- **Evidence:** `web/public/manifest.webmanifest` `"icons": []`; only
  `.gitkeep`/`sw.js`/`tenant-sw.js` in `public/` — no PNG/maskable assets.
- **Action:** add branded 192/512 + maskable icons; populate manifest.
  **Validation:** Lighthouse PWA "installable" passes on iOS Safari + Android
  Chrome.

---

## B. Missing capabilities (Not-Implemented)

| ID | Role | Gap | Sev | Dependency | Recommended action | Validation |
|---|---|---|---|---|---|---|
| AUTH-001/002/004/005/006/008 | all | No password login/hashing/rate-limit/reset/first-login/generic-error | P0 | LR-001 | Credentials provider + Argon2id + throttle + reset (M1) | M1 test suite (AUTH_SPEC) |
| SEC-002/003 | all | `users.role` never read; no `technician` role/RBAC | P0 | AUTH-001 | Add role, RBAC guards | RBAC integration test |
| ASN-003/005/008 | Op/Tech | No org fallback assignee, no absence/escalation, silent-unassigned possible | P0/P1 | ASN-001 | Config fallback + coverage rules | routing tests |
| LOC-001..008 | T/Op | No buildings/floors/suites/tenant_companies model | P0 | LR-011 | New tables + backfill + RLS (M3) | migration + RLS + context tests |
| ATT-006 | T/Tech | No HEIC handling | P0 | — | Accept/transcode HEIC or client-convert | iPhone HEIC round-trip |
| SUM-001/002 | T/Op | No structured completion record | P0 | LIF-004, ATT-010 | Assemble deterministic summary at resolve | summary content test |
| TEC-001/002/003/005/006/007 | Tech | No technician mobile surface (queue/detail/messaging/notes/photos) | P0 | SEC-003, ASN-001 | Build tech PWA (M4) | tech e2e |
| EML-005/007 | Op/T | No completion / escalation email | P1/P2 | SUM-002 | Add events | email tests |
| PUSH-003/005 | all | Untested push matrix; no real-device validation | P0 | PWA-001 | Test + validate on devices (M7) | device matrix |
| OBS-001/002/003/005 | Sys | No CI, error tracking, structured logging, pipeline migrations | P1 | — | GH Actions + Sentry + logger (M0) | CI runs on PR |
| VEN-007 | Vendor | COI not surfaced in vendor area | P2 | — | Vendor "Documents" tab | vendor portal test |
| LIF-007 | T | `blockedReason` never written ⇒ dormant labels | P1 | — | Write `blocked_reason` on block transitions | label test |

## C. Partial / hardening (built, needs completion or verification)

| ID | Role | Gap | Sev | Recommended action | Validation |
|---|---|---|---|---|---|
| IDN-001/TEN-002 | T/Op/Tech | Submitter stored but display incomplete | P0 | Show name+email in ops + tech detail | UI assert |
| SEC-005 | Sys | Security headers set, no CSP | P1 | Add CSP (report-only → enforce) | header test |
| ATT-007/008/009 | all | Inconsistent size caps (tenant 50MB, staff none), no MIME allowlist, thin audit | P0/P1 | MIME allowlist + unified cap + audit rows | upload validation test |
| MSG-004/007 | T/Op | Audience labels imprecise; no pagination | P1 | Relabel; paginate long threads | UI/perf test |
| EML-008/011 | all | Deep links session-gated (ok) but no templates; prefs exist unused in email | P1 | Branded template + honor prefs | email render test |
| PUSH-002/004 | all | SW registers only on opt-in; prefs partial | P0/P1 | Register SW globally; wire prefs | subscription lifecycle test |
| ADM-003/004/006 | Op | Property-level ownership only; residential categories; reporting unverified at scale | P1 | Building rules + commercial cats + scale check | admin + report tests |
| ASN-002/004/006 | Op | Property-level auto-route only; no per-WO staff reassign UI; tenant path audit | P0/P1 | Building routing + reassign UI + audit | routing tests |
| OBS-004/006/007 | Sys | Trivial health check; stale smoke; rollback undocumented | P1 | Dep-checked health + Lucid smoke + rollback runbook | smoke run |

## D. Complete & verified (in production; Lucid acceptance still pending)

| ID | Evidence | Note |
|---|---|---|
| SEC-001, RLS boundary | `rls-policies.sql` ENABLE+FORCE 32 tables; `rls.test.ts`, `tenant-rls.test.ts` (ADR-006) | keep intact; extend to LOC |
| LIF-001/004, TEC-008/009 | 10-state machine + enforcement `work-orders.ts:248`; confirm/reopen `tenant-work-orders.ts:356-458`; authoritative complete `:256` | reconcile per WORK_ORDER_LIFECYCLE |
| ATT-001/004/005 | signed-URL view + RLS role access `storage.ts`, `entity-detail.ts:243` | verify tech role read (ATT-002) |
| COI-001/002/003, VEN-005 | COI record/sweep/gate `compliance.ts`,`coi.ts`,`work-orders.ts:379` | distinct vendor identity |
| EML-010 | delivery logging status/error/providerMessageId `notifications.ts:78-93` | good foundation |

## E. Unverified assumptions & blocked items (must confirm, don't assume)

- **Email actually sending in prod** — code path real *iff* `RESEND_API_KEY` +
  verified domain set in Vercel (prior STATUS notes used `onboarding@resend.dev`).
  **Blocked-infra / unverified** → verify in M6 (EML-012).
- **Web push actually sending in prod** — real *iff* VAPID keys set.
  **Unverified** → M7.
- **Inngest crons firing** — need `INNGEST_EVENT_KEY`/`SIGNING_KEY`. **Blocked-infra.**
- **Twilio SMS** — stubbed pending A2P 10DLC. **Blocked-infra** (SMS not a pilot
  channel; email + push are).
- **`E2E_BYPASS_AUTH`** must never be set in production (`auth.ts:19`,
  `tenant-auth.ts:44`) — **security assumption to verify** in the release
  checklist.
- **Prod-writing scripts** (`scripts/invite-demo-tenants.ts` etc.) target the live
  org with hard-coded emails/URL — **operational risk to clean up** (M0).
- **Lucid data** (buildings/floors/suites/companies/users/routing) — **blocked on
  client input** (see [`CLIENT_INPUTS.md`](./CLIENT_INPUTS.md)).
