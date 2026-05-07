import { pgTable, text, uuid, timestamp, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  id,
  orgId,
  timestamps,
  notificationChannelEnum,
  polymorphicTargetEnum,
} from "./_shared";

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    orgId: orgId(),
    // Recipient: either a staff user (Clerk-mirrored) or a vendor user.
    recipientUserId: uuid("recipient_user_id"),
    recipientVendorUserId: uuid("recipient_vendor_user_id"),

    channel: notificationChannelEnum("channel").notNull(),
    kind: text("kind").notNull(), // wo_assigned | wo_blocked | wo_resolved | template_spawned | ...
    subject: text("subject").notNull(),
    body: text("body").notNull(),

    // Optional polymorphic link back to the entity that triggered this.
    targetType: polymorphicTargetEnum("target_type"),
    targetId: uuid("target_id"),

    // Dispatch state.
    status: text("status").notNull().default("pending"), // pending | sent | failed
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
    providerMessageId: text("provider_message_id"),

    payload: jsonb("payload"),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("notifications_org_idx").on(t.orgId),
    recipientUserIdx: index("notifications_recipient_user_idx").on(t.recipientUserId),
    recipientVendorIdx: index("notifications_recipient_vendor_idx").on(t.recipientVendorUserId),
    statusIdx: index("notifications_status_idx").on(t.status),
  }),
);

/**
 * Per-user per-channel preference. Keyed on either users.id or
 * vendor_users.id (mirrors notifications.recipient_*). One row per channel
 * means a user can opt in to email but out of SMS.
 *
 * Default behavior when no row exists: email enabled, sms disabled, push
 * disabled, in_app enabled.
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: id(),
    orgId: orgId(),
    userId: uuid("user_id"),
    vendorUserId: uuid("vendor_user_id"),
    channel: notificationChannelEnum("channel").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("notification_prefs_org_idx").on(t.orgId),
    userUnique: uniqueIndex("notification_prefs_user_unique").on(t.userId, t.channel),
    vendorUnique: uniqueIndex("notification_prefs_vendor_unique").on(t.vendorUserId, t.channel),
  }),
);
