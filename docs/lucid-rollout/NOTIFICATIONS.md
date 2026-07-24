# Lucid Rollout — Notification Specification

**Owner:** Workflows & Backend · **Update freq:** per notification change · **Requirements:** EML-*, PUSH-*, MSG-006 · **Decisions:** LR-008 (email first in build order; push is a launch gate).

Infra today: `notifications` + `notification_preferences` tables
(`db/schema/notifications.ts`); dispatch via `emitNotification`
(`lib/server/notifications.ts`) → Inngest `dispatch-notification.ts` → channel
senders (`email.ts`/Resend, `sms.ts`/Twilio, `push.ts`/web-push, in_app). Each
sender is "real-if-configured, else log-stub-and-succeed". Delivery state
(`status`/`sentAt`/`error`/`providerMessageId`) is recorded — a solid foundation.

Channels this phase: **email + in_app** (pilot base), **web push** (launch gate,
M7). **SMS** is stubbed pending Twilio A2P 10DLC and is **not** a pilot channel.

## 1. Event taxonomy
Existing kinds (`notifications.ts:18-27`): `wo_submitted`, `wo_assigned`,
`wo_status`, `wo_blocked`, `wo_resolved`, `wo_verified`, `wo_message`,
`wo_reopened`, `template_spawned`. **Fix:** the Inngest event contract only
declares 5 (`dispatch-notification.ts:8-13`) — align it with the 9 (EML/OBS).

| Event | Trigger | Primary recipient | Channels | Req |
|---|---|---|---|---|
| `wo_submitted` | resident submits | covering tech + ops | email + in_app (+push M7) | EML-001 |
| `wo_assigned` | auto/manual assign | assignee (tech/vendor) | email + push + in_app | EML-002 |
| `wo_status` | status change (to tenant) | tenant | email + in_app (+push) | EML-006, TEN-007 |
| `wo_blocked` | → blocked | creator/tenant | email + in_app | EML-006 |
| `wo_message` | new **external** message | the other participant | email + in_app (+push) | EML-003, MSG-006 |
| `wo_resolved` | tech completes | tenant (+ ops) | email + in_app + push | EML-005 |
| `wo_verified` | tenant confirms | tech (+ ops) | email + in_app | EML-006 |
| `wo_reopened` | tenant reopens | tech (+ ops) | email + in_app + push | EML-006 |
| `wo_escalated` *(new)* | overdue/absence | ops/manager | email + in_app | EML-007, ASN-005 |

**Defect to fix (EML-004):** status-change notifications to staff/tech pass
`recipientEmail: null` (`work-orders.ts:315-317`) → never email. Pass the recipient
email and honor preferences.

## 2. Recipients & routing
- `recipient_user_id` (staff/tech), `recipient_vendor_user_id`,
  `recipient_tenant_user_id` — exactly one set per notification.
- Tenant events route via `createdByTenantUserId` → `tenant_users`. Assignment
  events route via the active `assignments` row (so ASN-001 must be fixed or techs
  won't be reachable for tenant WOs).
- **Cross-tenant/building isolation:** a recipient only ever receives events for
  their own WOs/scope. Never include another company's data in a payload.

## 3. Email templates (EML-011)
- Today: inline `<p>${escapeHtml(body)}</p>` (`notifications.ts:335`). Add a
  single branded, responsive HTML template (STACK header, WO number + title,
  context, CTA button → deep link, footer with preference link). Escape all
  interpolated content (helper exists `:371-376`).
- Subject convention: `STACK · WO-<n> · <event summary>`.
- **Privacy:** include enough context to act, but not sensitive/internal notes or
  financial data. Never expose internal comments in tenant emails.

## 4. Deep links (EML-008)
- Links point at authenticated pages, not public token URLs: operators →
  `/work-orders/{id}` (or drawer `?d=`), tenants → `/tenant/WO-{n}`, techs →
  the technician detail route (M4). Access is session-gated; a recipient without a
  session signs in first. Ensure the link target enforces the same RLS scope.

## 5. Retry & idempotency (EML-009)
- **Defect:** the whole dispatch is one `step.run` with no idempotency key
  (`dispatch-notification.ts:42`), and `emitNotification` also falls back to inline
  dispatch — a retry can double-send.
- **Fix:** one `notifications` row per (recipient, event, channel); use its id as
  the idempotency key; each channel `step.run` is keyed so Inngest retries are
  idempotent; mark `sent` only after provider ack; do not double-path
  inline+Inngest for the same row.

## 6. Delivery logging & observability (EML-010, OBS-002)
- Keep recording `status` (pending|sent|failed), `sentAt`, `error`,
  `providerMessageId` (Resend id / Twilio SID). Surface failed sends to error
  tracking (OBS-002) and an admin "notification log" view. Prune dead push subs on
  404/410 (already done, `push.ts:69-72`).

## 7. User preferences (EML-011, PUSH-004)
- `notification_preferences` (per user/vendor × channel) exists; defaults: email
  on, in_app on, sms off, push off-until-opted-in. Honor prefs in `emitNotification`
  for non-critical events. **Critical** events (assignment to a tech, completion to
  a tenant) always send at least one channel. Add a tenant-facing preferences UI
  (M7).

## 8. Escalation rules (EML-007)
- Overdue (past `dueAt`) or technician-absence (ASN-005) triggers `wo_escalated`
  to the manager/fallback. Driven by an Inngest scheduled sweep (reuse the
  compliance-sweep pattern). Advisory for the pilot; tune thresholds with STACK.

## 9. Push equivalents (PUSH-006) & rollout sequence
- Every user-facing email event has a push equivalent (short title + body + deep
  link). Web push is **operational when VAPID keys are set** but the SW only
  registers on opt-in and the PWA is not installable (PWA-001).
- **Rollout order (LR-008):** (1) reliable in_app + email (M6) → (2) fix
  manifest/icons/SW + register SW globally (M7/PWA) → (3) web push on supported
  devices → (4) test foreground/background/closed/expired/revoked (PUSH-003) →
  (5) preferences → (6) **validate on real iPhone + Android (PUSH-005) — launch
  gate** → then consider native (M10, deferred).

## 10. Security / privacy constraints
- Provider keys (`RESEND_API_KEY`, VAPID, future SMTP/Twilio) are env-only, never
  committed (SEC-006, EML-012).
- No cross-tenant leakage in any payload or deep link.
- Rate/dedupe outbound so a retry storm can't spam a recipient.
- Email content minimally sensitive; internal notes never leave the operator
  boundary.
