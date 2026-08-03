import "server-only";
import { and, eq } from "drizzle-orm";
import { notificationPreferences } from "@db/schema/notifications";
import { withStaffScope } from "./db";
import { ensureUserRow } from "./ensure-user";
import type { NotificationChannel } from "@contracts/polymorphic";

/**
 * Per-user notification channel preferences (self-service opt-out). The dispatch
 * pipeline already honors `notification_preferences` in `enabledChannels`; this
 * is the missing write side + the shape the settings UI renders.
 *
 * `in_app` is intentionally NOT toggleable — it's the bell/inbox, the always-on
 * record of what happened. Only the "push it to me" channels are opt-out-able.
 */
export const TOGGLEABLE_CHANNELS: NotificationChannel[] = ["email", "sms", "push"];

/** Staff defaults, mirroring `enabledChannels` (all on for a staff member). */
const STAFF_DEFAULTS: Record<NotificationChannel, boolean> = {
  email: true,
  sms: true,
  push: true,
  in_app: true,
};

export interface ChannelPref {
  channel: NotificationChannel;
  enabled: boolean;
}

/** The current staff member's effective toggle state (defaults + overrides). */
export async function getMyNotificationPreferences(): Promise<ChannelPref[]> {
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const rows = await tx
      .select({ channel: notificationPreferences.channel, enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.orgId, ctx.orgId), eq(notificationPreferences.userId, userId)));
    const explicit = new Map(rows.map((r) => [r.channel, r.enabled]));
    return TOGGLEABLE_CHANNELS.map((channel) => ({
      channel,
      enabled: explicit.get(channel) ?? STAFF_DEFAULTS[channel],
    }));
  });
}

/** Upsert the current staff member's preference for one channel. */
export async function setMyNotificationPreference(
  channel: NotificationChannel,
  enabled: boolean,
): Promise<void> {
  if (!TOGGLEABLE_CHANNELS.includes(channel)) throw new Error("channel_not_toggleable");
  await withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    await tx
      .insert(notificationPreferences)
      .values({ orgId: ctx.orgId, userId, channel, enabled })
      // One row per (user, channel) — flip the existing row on repeat.
      .onConflictDoUpdate({
        target: [notificationPreferences.userId, notificationPreferences.channel],
        set: { enabled, updatedAt: new Date() },
      });
  });
}
