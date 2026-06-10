import { pgTable, text, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { id, orgId, timestamps } from "./_shared";

/**
 * Web-push subscriptions for staff users (internal maintenance techs). One
 * row per browser/device endpoint. Keyed to a staff `users.id` — the
 * internal-first technician model. (Vendor-user push can be added later by
 * mirroring `recipient_vendor_user_id` the way `notifications` does.)
 *
 * `endpoint` is the push service URL; `p256dh` + `auth` are the client's
 * encryption keys from the PushSubscription. We send via the `web-push`
 * library using server-held VAPID keys (see lib/server/push.ts).
 *
 * RLS: standard staff org-scope policy (see rls-policies.sql). Writes happen
 * under the user actor (subscribe route); the notification dispatcher reads
 * under the system actor, which the staff policy permits.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    orgId: orgId(),
    userId: uuid("user_id").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => ({
    orgUserIdx: index("push_subscriptions_org_user_idx").on(t.orgId, t.userId),
    endpointUnique: uniqueIndex("push_subscriptions_endpoint_unique").on(
      t.endpoint,
    ),
  }),
);
