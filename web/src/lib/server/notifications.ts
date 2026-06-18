import "server-only";
import { and, eq } from "drizzle-orm";
import { notifications, notificationPreferences } from "@db/schema/notifications";
import { sendEmail } from "./email";
import { sendSms } from "./sms";
import {
  loadPushSubscriptions,
  prunePushSubscription,
  sendWebPush,
  type PushPayload,
} from "./push";
import { withScope, type ScopedDB } from "./db";
import type { ActorType, NotificationChannel, PolymorphicTarget } from "@contracts/polymorphic";
import { inngest } from "@/lib/inngest-client";

export type NotificationKind =
  | "wo_assigned"
  | "wo_blocked"
  | "wo_resolved"
  | "wo_verified"
  | "template_spawned";

export interface DispatchInput {
  orgId: string;
  recipientUserId?: string | null;
  recipientVendorUserId?: string | null;
  channel: NotificationChannel;
  kind: NotificationKind;
  subject: string;
  body: string;
  targetType?: PolymorphicTarget;
  targetId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Persist a notification row and queue its dispatch via Inngest.
 *
 * Caller decides who and how (channel). Use {@link emitNotification} to send
 * an event that Inngest fans out to multiple channels by reading
 * notification_preferences.
 */
export async function recordNotification(
  tx: ScopedDB,
  input: DispatchInput,
): Promise<{ id: string }> {
  const r = await tx
    .insert(notifications)
    .values({
      orgId: input.orgId,
      recipientUserId: input.recipientUserId ?? null,
      recipientVendorUserId: input.recipientVendorUserId ?? null,
      channel: input.channel,
      kind: input.kind,
      subject: input.subject,
      body: input.body,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      payload: (input.payload ?? null) as never,
      status: "pending",
    })
    .returning({ id: notifications.id });
  return { id: r[0]!.id };
}

/**
 * Mark a notification as sent / failed. Called by the Inngest dispatch
 * function once the channel returns.
 */
export async function markNotificationStatus(
  tx: ScopedDB,
  id: string,
  patch: { status: "sent" | "failed"; providerMessageId?: string | null; error?: string | null },
) {
  await tx
    .update(notifications)
    .set({
      status: patch.status,
      sentAt: patch.status === "sent" ? new Date() : null,
      providerMessageId: patch.providerMessageId ?? null,
      error: patch.error ?? null,
      updatedAt: new Date(),
    })
    .where(eq(notifications.id, id));
}

/**
 * Read prefs for a recipient. Returns the set of enabled channels.
 *
 * Default when no prefs row exists: email + in_app on for everyone; SMS + push
 * default ON for staff (internal techs — reliable phone awareness is the whole
 * point) and OFF for vendors. SMS only fires with a phone on file and push only
 * with a registered subscription, so default-on with neither is a harmless
 * no-op. Any recipient can override via notification_preferences.
 */
export async function enabledChannels(
  tx: ScopedDB,
  orgId: string,
  recipient: { userId?: string | null; vendorUserId?: string | null },
): Promise<NotificationChannel[]> {
  const channels: NotificationChannel[] = ["email", "sms", "push", "in_app"];
  const isStaff = !!recipient.userId;
  // Staff techs get SMS by default — they miss email, and a text on a new
  // assignment is the reliable alert (the customer's #1 ask). Gated on a phone
  // being on file, so default-on with no number is a harmless no-op. Vendors
  // default SMS off. Either side can override via notification_preferences.
  const defaults: Record<NotificationChannel, boolean> = {
    email: true,
    sms: isStaff,
    push: isStaff,
    in_app: true,
  };

  const idCol = recipient.userId
    ? eq(notificationPreferences.userId, recipient.userId)
    : recipient.vendorUserId
      ? eq(notificationPreferences.vendorUserId, recipient.vendorUserId)
      : null;
  if (!idCol) return [];

  const rows = await tx
    .select()
    .from(notificationPreferences)
    .where(and(eq(notificationPreferences.orgId, orgId), idCol));

  const explicit = new Map<NotificationChannel, boolean>();
  for (const r of rows) explicit.set(r.channel, r.enabled);

  return channels.filter((c) => explicit.get(c) ?? defaults[c]);
}

/**
 * Top-level entry point used by the app. Emits an Inngest event that the
 * dispatch function consumes; consumers send via Resend / Twilio / etc.
 *
 * In dev (no INNGEST_EVENT_KEY) — and on any send failure — this falls
 * through to immediate inline dispatch via {@link dispatchInline} so the
 * notification still goes out. We swallow errors from this path: a
 * notification failure should never block the user-driven action that
 * triggered it.
 */
export async function emitNotification(args: {
  orgId: string;
  recipientUserId?: string | null;
  recipientVendorUserId?: string | null;
  kind: NotificationKind;
  subject: string;
  body: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  targetType?: PolymorphicTarget;
  targetId?: string;
  actor?: { type: ActorType; userId?: string | null };
}): Promise<void> {
  if (!args.recipientEmail && !args.recipientPhone) return;

  const useInngest =
    process.env.INNGEST_EVENT_KEY && process.env.INNGEST_EVENT_KEY.length > 0;

  if (useInngest) {
    try {
      await inngest.send({
        name: "stack-os/notification.emit",
        data: { ...args },
      });
      return;
    } catch (e) {
      // Fall through to inline.
      // eslint-disable-next-line no-console
      console.warn("[notify] inngest.send failed; falling back to inline:", (e as Error).message);
    }
  }

  try {
    await dispatchInline(args);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[notify] dispatchInline failed:", (e as Error).message);
  }
}

/**
 * Inline dispatcher used both by the Inngest function and by tests.
 * Reads prefs, sends via the appropriate channels, persists notifications
 * rows, and returns a summary.
 */
export async function dispatchInline(args: {
  orgId: string;
  recipientUserId?: string | null;
  recipientVendorUserId?: string | null;
  kind: NotificationKind;
  subject: string;
  body: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  targetType?: PolymorphicTarget;
  targetId?: string;
}): Promise<{ sent: NotificationChannel[]; failed: NotificationChannel[] }> {
  const sent: NotificationChannel[] = [];
  const failed: NotificationChannel[] = [];

  await withScope({ orgId: args.orgId, actorType: "system" }, async (tx) => {
    const channels = await enabledChannels(tx, args.orgId, {
      userId: args.recipientUserId,
      vendorUserId: args.recipientVendorUserId,
    });

    for (const channel of channels) {
      // Skip channels with no recipient address.
      if (channel === "email" && !args.recipientEmail) continue;
      if (channel === "sms" && !args.recipientPhone) continue;
      if (channel === "push") {
        // Web-push to every device the staff user has registered. Records one
        // notifications row reflecting the aggregate outcome; prunes any
        // subscription the push service reports as gone (404/410).
        if (!args.recipientUserId) continue; // vendor push not wired yet
        const subs = await loadPushSubscriptions(
          tx,
          args.orgId,
          args.recipientUserId,
        );
        if (subs.length === 0) continue;

        const { id } = await recordNotification(tx, {
          orgId: args.orgId,
          recipientUserId: args.recipientUserId,
          recipientVendorUserId: args.recipientVendorUserId,
          channel: "push",
          kind: args.kind,
          subject: args.subject,
          body: args.body,
          targetType: args.targetType,
          targetId: args.targetId,
        });

        const payload: PushPayload = {
          title: args.subject,
          body: args.body,
          url: targetUrl(args.targetType, args.targetId),
          tag: args.targetId ?? args.kind,
        };
        let anyOk = false;
        let lastError: string | undefined;
        for (const sub of subs) {
          const r = await sendWebPush(sub, payload);
          if (r.ok) anyOk = true;
          else {
            lastError = r.error;
            if (r.gone) await prunePushSubscription(tx, sub.id);
          }
        }
        if (anyOk) {
          await markNotificationStatus(tx, id, { status: "sent" });
          sent.push("push");
        } else {
          await markNotificationStatus(tx, id, {
            status: "failed",
            error: lastError ?? "all push sends failed",
          });
          failed.push("push");
        }
        continue;
      }
      if (channel === "in_app") {
        const { id } = await recordNotification(tx, {
          orgId: args.orgId,
          recipientUserId: args.recipientUserId,
          recipientVendorUserId: args.recipientVendorUserId,
          channel: "in_app",
          kind: args.kind,
          subject: args.subject,
          body: args.body,
          targetType: args.targetType,
          targetId: args.targetId,
        });
        await markNotificationStatus(tx, id, { status: "sent" });
        sent.push("in_app");
        continue;
      }

      const { id } = await recordNotification(tx, {
        orgId: args.orgId,
        recipientUserId: args.recipientUserId,
        recipientVendorUserId: args.recipientVendorUserId,
        channel,
        kind: args.kind,
        subject: args.subject,
        body: args.body,
        targetType: args.targetType,
        targetId: args.targetId,
      });

      try {
        if (channel === "email" && args.recipientEmail) {
          const r = await sendEmail({
            to: args.recipientEmail,
            subject: args.subject,
            html: `<p>${escapeHtml(args.body)}</p>`,
            text: args.body,
          });
          await markNotificationStatus(tx, id, {
            status: "sent",
            providerMessageId: r.id,
          });
          sent.push("email");
        } else if (channel === "sms" && args.recipientPhone) {
          // Real Twilio send when configured; stubs (id=null) otherwise. A
          // real-send error throws → the outer catch marks this failed.
          const r = await sendSms({
            to: args.recipientPhone,
            body: `${args.subject} — ${args.body}`,
          });
          await markNotificationStatus(tx, id, {
            status: "sent",
            providerMessageId: r.id ?? "stub",
          });
          sent.push("sms");
        }
      } catch (e) {
        await markNotificationStatus(tx, id, {
          status: "failed",
          error: (e as Error).message.slice(0, 500),
        });
        failed.push(channel);
      }
    }
  });

  return { sent, failed };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Deep link a notification opens to. Work orders are the dominant case and
 * land on the legacy detail route (which carries status + photo + comment
 * actions). Other targets fall back to My Work.
 */
function targetUrl(
  targetType: PolymorphicTarget | undefined,
  targetId: string | undefined,
): string {
  if (!targetType || !targetId) return "/my";
  switch (targetType) {
    case "work_order":
      return `/work-orders/${targetId}`;
    case "inspection":
      return `/inspections/${targetId}`;
    case "project":
      return `/projects/${targetId}`;
    default:
      return "/my";
  }
}
