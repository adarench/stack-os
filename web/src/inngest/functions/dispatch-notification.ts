import { inngest } from "../client";
import { dispatchInline } from "@/lib/server/notifications";

/**
 * Event payload mirrors {@link dispatchInline}'s argument exactly, so tenant
 * recipients, deep-link overrides, and the EML-009 dedupe key all survive the
 * hop through Inngest (the old hand-maintained interface silently dropped them).
 */
type NotificationEventData = Parameters<typeof dispatchInline>[0];

/**
 * Event-triggered dispatcher: reads notification_preferences for the
 * recipient, sends email via Resend (branded template + deep link), SMS/push
 * per channel, records a notifications row per channel.
 *
 * Idempotency: `dispatchInline`'s per-channel dedupe key makes a retried step —
 * or a redelivered event — a no-op instead of a double-send (EML-009).
 */
export const dispatchNotification = inngest.createFunction(
  { id: "dispatch-notification" },
  { event: "stack-os/notification.emit" },
  async ({ event, step }) => {
    const data = event.data as NotificationEventData;
    const result = await step.run("dispatch", () => dispatchInline(data));
    return result;
  },
);
