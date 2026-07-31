# Stack OS — Notification Architecture

**Owner:** engineering · **Date:** 2026-07-29 · **Prod:** `13b9193`

The definitive map of every notification event across all four channels. Written
from a forensic code trace (verified end-to-end for email + web push). Pairs with
[`NOTIFICATIONS.md`](./NOTIFICATIONS.md) (taxonomy/rationale) and the graded status
in [`VERIFICATION_REPORT.md`](./VERIFICATION_REPORT.md).

## The four channels (kept separate on purpose)

| Channel | Transport | State | Notes |
|---|---|---|---|
| **A. Email** | Resend, sender `Stack OS <ops@stackstorage.us>` (domain verified) | **Production-verified (delivered)** | reset + invite observed delivered to an external inbox |
| **B. In-app** | `notifications` table → `/inbox` + bell badge | **Production-verified (staff)** | real dispatch→inbox exercised against the prod DB (`inbox-inapp.test.ts`); staff-only — tenants/vendors get rows but no inbox UI; "unread" ≈ last 24h (no per-user read state) |
| **C. Web push** | `web-push` + VAPID; `sw.js` / `tenant-sw.js` | **Automated + configured; not device-verified** | VAPID set in prod; real send path automated (`web-push-send.test.ts`); deep-link + logout-cleanup fixed 2026-07-29 |
| **D. Native iOS push (APNs)** | ES256 token-auth over HTTP/2 | **Code-complete, stub-until-keyed** | `tenant_device_tokens` + `apns.ts` sender + `/api/tenant/push/apns` + dispatcher fan-out + `NativePushRegister` all shipped; **stub no-op until an Apple `.p8` key is set** (then live, no code change). Delivery needs the key + a device. |
| **E. SMS / MMS** | Twilio (A2P 10DLC), `sms.ts` | **Live (delivered)** when the 3 Twilio env vars are set; else stub | Body is branded `Stack OS · <subject> — <body>` + the role-correct deep link + `Reply STOP to opt out.` Tech-facing sends set `attachWoPhotos` → the WO's still images (JPEG/PNG/GIF; HEIC + video excluded, ≤10 items / 5MB) are signed and attached as **MMS** so the tech gets the resident's photos in hand. Best-effort: no photos / storage off / MMS error degrades to a plain text — the tech's deep link still shows the photos. |

**One pipeline, many channels.** All events flow through `emitNotification()` →
Inngest (`dispatch-notification.ts`) when `INNGEST_EVENT_KEY` is set, else an inline
fallback → `dispatchInline()` (`notifications.ts`), which reads per-recipient channel
prefs and fans out to A/B/C/E. Defaults: staff = email + in-app + web push + SMS
(once a phone is set); tenants = all channels; vendors = email + in-app (vendor push
not wired). SMS is gated per-emit on a `recipientPhone` being passed, so it stays
scoped to key events even though the channel is default-on.

- **Payload (push):** `{ title, body, url, tag }` — the exact shape both service
  workers read (no mismatch).
- **Deep links:** staff → `/work-orders/<id>`; tenant → `/tenant/WO-<number>`.
- **Dedup:** per-channel `notifications.idempotency_key` partial-unique index →
  a retried dispatch is a no-op, not a double-send (EML-009).
- **Retry:** Inngest retries the dispatch; the `idempotency_key` makes it safe.
  Inline fallback is best-effort (no retry).
- **Failure:** email with no key → stub (`{id:null}`, logged, marked `sent`); push
  `404/410` → subscription soft-pruned; in-app row is always written.

## Event × recipient × channel matrix

Channel cells: **A** email · **B** in-app · **C** web push · **D** native. `✓` = wired
& invoked; `—` = not applicable; `✗(D)` = not implemented (native) everywhere.

| # | Event (trigger) | Recipient(s) | A | B | C | D | Deep link |
|---|---|---|---|---|---|---|---|
| 1 | **User invitation** (`adminSendInvite` → `requestPasswordReset{invite}`) | invitee | ✓ | — | — | ✗ | `/reset?token` / `/tenant/reset?token` |
| 2 | **Password reset** (`/forgot` → `requestPasswordReset`) | subject | ✓ | — | — | ✗ | same as above |
| 3 | **WO submitted** (`createWorkOrderFromTenant`) | assigned tech **+** ops team | ✓ | ✓ | ✓ | ✗ | `/work-orders/<id>` |
| 4 | **Technician assigned** (`assignTechnician`) | assigned tech | ✓ | ✓ | ✓ | ✗ | `/work-orders/<id>` |
| 4v | **Vendor assigned** (`assignVendor`) | assigned vendor user | ✓ | ✓ | — | ✗ | vendor portal |
| 5 | **Status changed** blocked/resolved/verified (`updateWorkOrderStatus`) | WO creator **+ assigned tech** (D7); ops team on `resolved`; ops fallback if unassigned tenant WO | ✓ | ✓ | ✓ | ✗ | `/work-orders/<id>` |
| 6 | **Tenant status update** (`updateWorkOrderStatus` on a tenant WO) | tenant | ✓ | ✓† | ✓ | ✗ | `/tenant/WO-<n>` |
| 7 | **WO completed** (`resolved` → tenant) | tenant | ✓ | ✓† | ✓ | ✗ | `/tenant/WO-<n>` |
| 8 | **WO reopened** (`reopenRequest` by tenant) | covering technician | ✓ | ✓ | ✓ | ✗ | `/work-orders/<id>` |
| 9 | **New message** (`createTenantComment` / staff external comment) | the other party (tenant ↔ covering tech) | ✓ | ✓† | ✓ | ✗ | WO detail (tenant/staff) |
| 10 | **Tenant confirms fixed** (`confirmResolved`) | covering technician | ✓ | ✓ | ✓ | ✗ | `/work-orders/<id>` |
| 11 | **Account deactivated** (`setPersonActive`) | — (audit event only) | — | — | — | — | — |

† tenant in-app rows are written but there is no tenant-facing inbox UI yet (see B).

## Per-recipient reachability (who actually gets pinged)

| Event | Administrator | Manager / dispatcher | Assigned technician | Tenant |
|---|---|---|---|---|
| Invitation / reset | if subject | if subject | if subject | if subject |
| WO submitted | in-app+email+push (ops team) | in-app+email+push (ops team) | **email+in-app+push** | — |
| Assigned | — | — | **email+in-app+push** | — |
| Status changed | on `resolved` (ops team) | on `resolved` (ops team) | **email+in-app+push (D7)** | plain-language, if tenant WO |
| Completed | on `resolved` (ops team) | on `resolved` (ops team) | (actor) | **email+push** + tenant-safe summary |
| Reopened | — | — | **email+in-app+push** | (actor) |
| New message | — | — | email+in-app+push (tenant→tech) | email+push (staff→tenant) |

## Cross-channel dedup policy

No event is intentionally duplicated **across** channels for the same recipient —
each channel is a separate delivery of one logical notification (email + push + a
row in the inbox), which is expected. **Within** a channel, the per-recipient
`idempotency_key` prevents double-sends on retry. The `resolved` ops broadcast
excludes the creator, the assignee, and the actor so no operator is pinged twice
for one transition (D7).

## Known gaps / next

- **Native iOS push (D):** not implemented — needs a `device_tokens` table, APNs
  registration in the shell, and an APNs HTTP/2 send path (design in
  [`IOS_APP.md`](./IOS_APP.md)). Blocked on an Apple APNs key.
- **Tenant/vendor in-app inbox UI (B):** rows are written but not surfaced to those
  personas.
- **Vendor web push (C):** not wired (no `vendor_push_subscriptions`).
- **Web push device verification (C):** code is correct and deployed; a real
  subscription + delivery has not yet been observed on a device.
