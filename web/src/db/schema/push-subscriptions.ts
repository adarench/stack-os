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

/**
 * Web-push subscriptions for tenant (resident) users — mirror of the staff
 * table, keyed to a tenant_users.id. Residents subscribe from the tenant PWA;
 * the dispatcher reads under the system actor to send status/message pushes.
 */
export const tenantPushSubscriptions = pgTable(
  "tenant_push_subscriptions",
  {
    id: id(),
    orgId: orgId(),
    tenantUserId: uuid("tenant_user_id").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => ({
    orgTenantIdx: index("tenant_push_subs_org_tenant_idx").on(t.orgId, t.tenantUserId),
    endpointUnique: uniqueIndex("tenant_push_subs_endpoint_unique").on(t.endpoint),
  }),
);

/**
 * Native APNs device tokens for tenant (resident) users — the iOS app
 * (Capacitor shell around the tenant PWA) registers one APNs token per install.
 * Mirrors tenant_push_subscriptions but for native push: a `token` instead of a
 * web endpoint + keys. Sent via lib/server/apns.ts. `platform` leaves room for
 * android/FCM later. RLS: tenant-self policy + system read (see rls-policies.sql).
 */
export const tenantDeviceTokens = pgTable(
  "tenant_device_tokens",
  {
    id: id(),
    orgId: orgId(),
    tenantUserId: uuid("tenant_user_id").notNull(),
    token: text("token").notNull(),
    platform: text("platform").notNull().default("ios"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => ({
    orgTenantIdx: index("tenant_device_tokens_org_tenant_idx").on(t.orgId, t.tenantUserId),
    tokenUnique: uniqueIndex("tenant_device_tokens_token_unique").on(t.token),
  }),
);
