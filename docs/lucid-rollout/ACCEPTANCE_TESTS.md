# Lucid Rollout — Acceptance-Test Plan

**Owner:** QA + engineering · **Update freq:** per requirement reaching QA · **IDs:** see [`REQUIREMENTS_TRACKER.md`](./REQUIREMENTS_TRACKER.md).

A requirement is `Accepted` only when its acceptance case passes **and** a
stakeholder signs off. Automated coverage lives in `test/` (unit, integration
against a Neon branch, Playwright e2e with `E2E_BYPASS_AUTH` for seeded actors —
which must never be set in prod). Each case lists the assertion layer:
`UI · API · DB · AUTHZ · NOTIFY · AUDIT`.

---

## PART 1 — Canonical end-to-end acceptance test (the pilot gate)

**AT-CANONICAL — "Lucid employee → auto-assign → technician → completion →
confirm".** This is the single acceptance test that gates the pilot (M8). Runs
against production with real credentialed accounts (and mirrored as a Playwright
e2e against a seeded org).

> **Implemented as code (M8):** the DB-integration form of this loop lives in
> `test/integration/at-canonical.test.ts` and runs green in CI against the
> isolated `stack_os_ci` (7 steps: submit→auto-assign→queue→ack/start/reply/note→
> authoritative complete→tenant-safe summary→reopen→cross-org isolation). It
> asserts identity/attribution, the completion summary, the **internal-note
> boundary (no leak)**, the audit trail, and RLS isolation. What remains for
> *acceptance* (not code): running it on **production** with **real credentialed
> Lucid accounts** on **real devices**, plus stakeholder sign-off.

### Starting data
- Org: the Lucid production org. Building **B1** with floor **F3**, suite
  **S-301**; tenant company **Lucid**. Building B1's routing owner = technician
  **Oscar**; org fallback assignee = **Fernando**.
- Accounts (individual, password; provisioned via invite→set-password, secrets
  never committed): tenant **Sam @ Lucid** (mapped to company Lucid, suite S-301,
  building B1), technician **Oscar**, operator **STACK-Op**.
- Categories include the confirmed commercial set. Email (Resend, verified domain)
  and web push (VAPID) enabled.

### Actors
Sam (tenant, mobile), Oscar (technician, mobile), STACK-Op (operator, desktop).

### Steps, actions & expected results

1. **Sam signs in (mobile, password).**
   `AUTHZ` wrong password → generic error, no session, lockout after threshold.
   Correct password → tenant session cookie (httpOnly/secure/sameSite). `UI` lands
   on `/tenant`. `DB` no plaintext stored.

2. **Sam submits a request.** Title "AC not cooling — S-301", category **HVAC**,
   description + **1 photo (HEIC from iPhone)**.
   `DB` `work_orders` row: `createdByActorType='tenant'`,
   `createdByTenantUserId=Sam`, `category='hvac'`, unit/suite + building **derived
   from session** (not client input). `attachments` row `targetType='work_order'`,
   `uploadedByActorType='tenant'`, HEIC viewable. `AUDIT` `tenant_submitted`.

3. **System auto-assigns.** Because B1's owner is Oscar → `DB` WO `status='assigned'`
   + active `assignments{assigneeType:'user', assigneeId=Oscar}` (ASN-001). (If B1
   had no owner → fallback Fernando; never unassigned, ASN-008.) `AUDIT` assignment.

4. **Notifications fire.** `NOTIFY` Oscar receives `wo_assigned` (email + push);
   STACK sees it in the ops queue. Deep links are authenticated and scope-correct;
   no other company's data present.

5. **Oscar opens the request (mobile).** `AUTHZ` Oscar sees only assigned work.
   `UI` detail shows **requester identity (Sam + email)**, building/floor/suite/
   company, category, description, the tenant photo, access info. `DB`
   `acknowledgedAt` stamped (TEC-004 — only works because step 3 created an
   assignment).

6. **Oscar messages Sam.** Posts a **reply-to-requester** (external).
   `DB` `comments{visibility='external', actorType='user'}`; `tenantUpdatedAt`
   stamped. `NOTIFY` Sam gets `wo_message`.

7. **Sam sees the message and replies (mobile).** `UI` Sam sees Oscar's message
   (MSG-001 fix). Sam replies. `DB` tenant comment external; `tenantUpdatedAt`
   updated (MSG-010). `AUTHZ` Sam never sees internal notes; `NOTIFY` Oscar
   notified.

8. **Oscar starts work.** `assigned → in_progress`. `DB` `startedAt` set.
   `NOTIFY` Sam `wo_status` "In progress".

9. **Oscar adds a technician note + completion photo.** `DB` internal comment
   (not tenant-visible) + `attachments{kind:'after_photo', uploadedByActorType:'user'}`.
   `AUTHZ` Sam cannot see the internal note; can/will see the after-photo per policy.

10. **Oscar marks complete (authoritative).** `in_progress → resolved`.
    `DB` `completedAt` set; a **structured completion summary** (SUM-001) assembled
    (requester, building/floor/suite, tech, category, original issue, work
    performed, notes, completion photos, date/time, final status). `AUTHZ` **no
    operator step required** (LR-006). `NOTIFY` Sam gets `wo_resolved` + completion
    email with the summary + authenticated deep link.

11. **Sam receives the completion summary and confirms fixed.**
    `resolved → verified`. `UI` Sam sees "Completed" + summary. `DB`
    `tenant_confirmed_resolved` audit. `NOTIFY` Oscar "Ready to close".
    *(Reopen branch: Sam reopens → `resolved → in_progress`, `completedAt` nulled
    (LIF-005), Oscar notified `wo_reopened`.)*

12. **STACK sees the full audit trail (desktop).** `UI`/`AUDIT` STACK-Op sees the
    complete history: submitted → assigned (with reason) → messages → status
    changes → completion → confirmation, with requester identity, tenant + tech
    photos, and the completion summary. `AUTHZ` tenant/tech never saw internal/
    financial data.

### Cleanup
Cancel/close the test WO; deactivate or reset any throwaway accounts; do **not**
delete audit history. If run on prod, tag the WO as a test in notes.

### Pass criteria
All 12 steps pass with the stated DB/AUTHZ/NOTIFY/AUDIT assertions, no cross-tenant
leakage, no plaintext, and completion requires no redundant operator action.
Stakeholder sign-off records acceptance owner + date.

---

## PART 2 — Focused acceptance cases (by cluster)

### Auth & identity
- **AT-AUTH-01** individual credential login (each of operator/tech/tenant). `AUTHZ`
- **AT-AUTH-02** invalid login → generic error; rate-limit/lockout trips. `AUTHZ`
- **AT-AUTH-03** password reset (self + admin-assisted); no plaintext; sessions
  invalidated. `AUTHZ`
- **AT-AUTH-04** deactivated account blocked. `AUTHZ`
- **AT-IDN-01** submission carries the specific submitter's name+email (IDN-001). `DB/UI`

### Authorization boundaries
- **AT-SEC-01** tenant cannot read another company's WO/suite (RLS). `AUTHZ/DB`
- **AT-SEC-02** technician sees only assigned work; no internal/financial data. `AUTHZ`
- **AT-SEC-03** RBAC: operator vs technician surface separation; admin-only config. `AUTHZ`
- **AT-SEC-04** server-side enforcement (API rejects even if UI is bypassed). `API/AUTHZ`

### Tenant experience
- **AT-TEN-01** submit with title/desc/category/location/photo. `UI/DB`
- **AT-TEN-02** building/suite/company shown correctly (LOC). `UI`
- **AT-TEN-03** photo upload progress/failure-recovery/success; HEIC accepted. `UI`
- **AT-TEN-04** status + history visible; empty/loading/error/offline/session-expiry
  states behave. `UI`

### Assignment
- **AT-ASN-01** tenant WO auto-assigns building owner; owner shown; in tech "mine". `DB/UI`
- **AT-ASN-02** no building owner → org fallback; never unassigned. `DB`
- **AT-ASN-03** manual reassignment audited; assignment reasoning visible. `DB/UI/AUDIT`
- **AT-ASN-04** technician absence → coverage/escalation. `DB/NOTIFY`

### Messaging
- **AT-MSG-01** operator reply-to-requester is visible to the tenant + notifies
  (MSG-001 fix). `UI/DB/NOTIFY`
- **AT-MSG-02** internal note is NOT visible to the tenant (no leak). `AUTHZ`
- **AT-MSG-03** tenant↔technician back-and-forth persists across refresh/devices;
  correct sender/timestamp/audience label. `DB/UI`
- **AT-MSG-04** repeated submission is safe (idempotent). `API`

### Attachments
- **AT-ATT-01** tenant photo reaches STACK and the assigned technician. `AUTHZ/UI`
- **AT-ATT-02** technician photo capture/upload; thumb + full-size signed view. `UI`
- **AT-ATT-03** file-type/size validation; retry on failure; HEIC. `UI/API`
- **AT-ATT-04** completion photos linked to the completion record. `DB`

### Technician workflow
- **AT-TEC-01** queue shows only assigned; detail shows full context. `AUTHZ/UI`
- **AT-TEC-02** acknowledge/start, notes, photos, status updates. `DB`
- **AT-TEC-03** technician completion is authoritative (no operator step). `AUTHZ`
- **AT-ADM-01** admin adds a new technician; they can log in and receive work. `UI`

### Lifecycle & completion summary
- **AT-LIF-01** invalid transitions rejected server-side (all bypass paths). `API`
- **AT-LIF-02** duplicate completion is a no-op; reopen nulls `completedAt`. `DB`
- **AT-SUM-01** completion summary contains all required fields, grounded in
  history. `DB/UI`

### Notifications
- **AT-EML-01** each canonical-loop event emails the right recipient with a working
  authenticated deep link; no cross-tenant leak. `NOTIFY`
- **AT-EML-02** retry does not double-send (idempotency). `NOTIFY`
- **AT-EML-03** staff status-change email actually sends (EML-004 fix). `NOTIFY`
- **AT-PUSH-01** (M7 launch gate) push received foreground/background/closed/
  expired/revoked on real iPhone + Android. `DEVICE`
- **AT-PWA-01** installable on iOS + Android (icons/manifest/SW). `DEVICE`

### Operator oversight
- **AT-OP-01** operator sees all appropriate WOs, submitter identity+email, tenant
  + tech photos, status/history/notes/completion summary. `UI`
- **AT-OP-02** search/filter/sort/report across the portfolio at Lucid scale. `UI`

### External vendor (M9, post-pilot)
- **AT-VEN-01** vendor sees only assigned work; isolated from internal-tech data. `AUTHZ`
- **AT-VEN-02** vendor completes a job; COI accessible from vendor area. `UI`

---

## Traceability
Every requirement ID in the tracker maps to ≥1 case here; every case cites the
requirement(s) it accepts. The canonical AT-CANONICAL exercises the P0 spine end
to end and is the pilot's definition of done.
