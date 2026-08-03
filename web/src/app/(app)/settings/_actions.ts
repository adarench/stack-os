"use server";

import { revalidatePath } from "next/cache";
import { setMyNotificationPreference } from "@/lib/server/notification-prefs";
import type { NotificationChannel } from "@contracts/polymorphic";

/** Toggle one of the current staff member's notification channels. */
export async function setChannelPrefAction(input: {
  channel: NotificationChannel;
  enabled: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await setMyNotificationPreference(input.channel, input.enabled);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}
