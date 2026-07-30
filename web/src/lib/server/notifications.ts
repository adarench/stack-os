import "server-only";
import { and, eq, sql, inArray } from "drizzle-orm";
import { notifications, notificationPreferences } from "@db/schema/notifications";
import { users } from "@db/schema/users";
import { OPERATOR_ROLES } from "./roles";
import { sendEmail } from "./email";
import { renderNotificationEmail, absoluteUrl } from "./email-templates";
import { sendSms } from "./sms";
import {
  loadPushSubscriptions,
  prunePushSubscription,
  loadTenantPushSubscriptions,
  pruneTenantPushSubscription,
  sendWebPush,
  type PushPayload,
} from "./push";
import { sendApns, loadTenantDeviceTokens, pruneTenantDeviceToken } from "./apns";
import { withScope, type ScopedDB } from "./db";
import type { ActorType, NotificationChannel, PolymorphicTarget } from "@contracts/polymorphic";
import { inngest } from "@/lib/inngest-client";
import { logger, logError } from "./logger";

export type NotificationKind =
  | "wo_assigned"
  | "wo_blocked"
  | "wo_resolved"
  | "wo_verified"
  | "wo_submitted"
  | "wo_message"
  | "wo_reopened"
  | "wo_status"
  | "template_spawned";

export interface DispatchInput {
  orgId: string;
  recipientUserId?: string | null;
  recipientVendorUserId?: string | null;
  recipientTenantUserId?: string | null;
  channel: NotificationChannel;
  kind: NotificationKind;
  subject: string;
  body: string;
  targetType?: PolymorphicTarget;
  targetId?: string;
  payload?: Record<string, unknown>;
  /** EML-009 dedupe key (unique per org). A repeat insert is a no-op. */
  idempotencyKey?: string | null;
}

/**
 * Persist a notification row and queue its dispatch via Inngest.
 *
 * Caller decides who and how (channel). Use {@link emitNotification} to send
 * an event that Inngest fans out to multiple channels by reading
 * notification_preferences.
 *
 * Returns `null` when an `idempotencyKey` collides with an already-recorded
 * notification — the caller should treat that channel as already dispatched and
 * skip the send (EML-009: no double-send on retry).
 */
export async function recordNotification(
  tx: ScopedDB,
  input: DispatchInput,
): Promise<{ id: string } | null> {
  const r = await tx
    .insert(notifications)
    .values({
      orgId: input.orgId,
      recipientUserId: input.recipientUserId ?? null,
      recipientVendorUserId: input.recipientVendorUserId ?? null,
      recipientTenantUserId: input.recipientTenantUserId ?? null,
      channel: input.channel,
      kind: input.kind,
      subject: input.subject,
      body: input.body,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      payload: (input.payload ?? null) as never,
      idempotencyKey: input.idempotencyKey ?? null,
      status: "pending",
    })
    .onConflictDoNothing({
      target: [notifications.orgId, notifications.idempotencyKey],
      where: sql`${notifications.idempotencyKey} is not null`,
    })
    .returning({ id: notifications.id });
  return r[0] ? { id: r[0].id } : null;
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
  recipient: {
    userId?: string | null;
    vendorUserId?: string | null;
    tenantUserId?: string | null;
  },
): Promise<NotificationChannel[]> {
  const channels: NotificationChannel[] = ["email", "sms", "push", "in_app"];
  // Tenants have no preferences row — residents get every channel (sms/push
  // are harmless no-ops without a phone/subscription on file).
  if (recipient.tenantUserId && !recipient.userId && !recipient.vendorUserId) {
    return channels;
  }
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
  recipientTenantUserId?: string | null;
  kind: NotificationKind;
  subject: string;
  body: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  targetType?: PolymorphicTarget;
  targetId?: string;
  /** Deep link override for push/email (e.g. the tenant route). */
  url?: string;
  /**
   * EML-009 dedupe seed. Combined with the channel to guard against a repeat
   * dispatch (Inngest retry / double emit) resending. Omit for events that may
   * legitimately fire more than once for the same target.
   */
  dedupeKey?: string | null;
  actor?: { type: ActorType; userId?: string | null };
}): Promise<void> {
  // Reachable iff we have an address OR a push-capable recipient id (staff /
  // tenant) — a resident may have a push subscription but no email/phone.
  if (
    !args.recipientEmail &&
    !args.recipientPhone &&
    !args.recipientUserId &&
    !args.recipientTenantUserId
  ) {
    return;
  }

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
      logger.warn("notify.inngest_send_failed", {
        kind: args.kind,
        orgId: args.orgId,
        err: e,
      });
    }
  }

  try {
    await dispatchInline(args);
  } catch (e) {
    logError("notify.dispatch_failed", e, { kind: args.kind, orgId: args.orgId });
  }
}

/**
 * Notify the whole operator team about a work order (email + push + in_app),
 * skipping one user — the assignee doesn't need the "new WO" ping about their
 * own job ("send an email to all three of us… except if it's Oscar's, he
 * wouldn't get it"). Technicians are excluded by role, so the covering tech is
 * never on this list; `excludeUserId` also drops an operator who is the actor.
 */
export async function notifyOpsTeam(args: {
  orgId: string;
  excludeUserId?: string | null;
  /** Drop several operators at once (e.g. the creator AND the assignee). */
  excludeUserIds?: (string | null | undefined)[];
  kind: NotificationKind;
  subject: string;
  body: string;
  targetType?: PolymorphicTarget;
  targetId?: string;
  url?: string;
  dedupeKey?: string | null;
}): Promise<void> {
  const recipients = await withScope({ orgId: args.orgId, actorType: "system" }, (tx) =>
    tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.orgId, args.orgId), inArray(users.role, [...OPERATOR_ROLES]))),
  );
  const excluded = new Set<string>();
  if (args.excludeUserId) excluded.add(args.excludeUserId);
  for (const id of args.excludeUserIds ?? []) if (id) excluded.add(id);
  // De-dupe by user id (some orgs have historical duplicate rows).
  const seen = new Set<string>();
  for (const r of recipients) {
    if (seen.has(r.id) || excluded.has(r.id)) continue;
    seen.add(r.id);
    await emitNotification({
      orgId: args.orgId,
      recipientUserId: r.id,
      recipientEmail: r.email,
      kind: args.kind,
      subject: args.subject,
      body: args.body,
      targetType: args.targetType,
      targetId: args.targetId,
      url: args.url,
      dedupeKey: args.dedupeKey ? `${args.dedupeKey}:${r.id}` : null,
      actor: { type: "system" },
    });
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
  recipientTenantUserId?: string | null;
  kind: NotificationKind;
  subject: string;
  body: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  targetType?: PolymorphicTarget;
  targetId?: string;
  url?: string;
  dedupeKey?: string | null;
}): Promise<{ sent: NotificationChannel[]; failed: NotificationChannel[] }> {
  const sent: NotificationChannel[] = [];
  const failed: NotificationChannel[] = [];

  // Per-channel dedupe key: the same event dispatched twice (Inngest retry)
  // collides on the unique index and the second send is skipped (EML-009).
  const keyFor = (channel: NotificationChannel): string | null =>
    args.dedupeKey ? `${args.dedupeKey}:${channel}` : null;

  await withScope({ orgId: args.orgId, actorType: "system" }, async (tx) => {
    const channels = await enabledChannels(tx, args.orgId, {
      userId: args.recipientUserId,
      vendorUserId: args.recipientVendorUserId,
      tenantUserId: args.recipientTenantUserId,
    });

    for (const channel of channels) {
      // Skip channels with no recipient address.
      if (channel === "email" && !args.recipientEmail) continue;
      if (channel === "sms" && !args.recipientPhone) continue;
      if (channel === "push") {
        // Push to every device the recipient registered: web-push to browsers
        // (staff OR tenant) AND native APNs to the tenant iOS app. Records one
        // aggregate notifications row; prunes any endpoint/token the service
        // reports as gone (404/410). Vendor push isn't wired.
        const isTenant = !args.recipientUserId && !!args.recipientTenantUserId;
        if (!args.recipientUserId && !args.recipientTenantUserId) continue;
        const subs = args.recipientUserId
          ? await loadPushSubscriptions(tx, args.orgId, args.recipientUserId)
          : await loadTenantPushSubscriptions(tx, args.orgId, args.recipientTenantUserId!);
        // Native APNs tokens only exist for tenants (the iOS app is the tenant app).
        const deviceTokens = isTenant
          ? await loadTenantDeviceTokens(tx, args.orgId, args.recipientTenantUserId!)
          : [];
        if (subs.length === 0 && deviceTokens.length === 0) continue;

        const rec = await recordNotification(tx, {
          orgId: args.orgId,
          recipientUserId: args.recipientUserId,
          recipientVendorUserId: args.recipientVendorUserId,
          recipientTenantUserId: args.recipientTenantUserId,
          channel: "push",
          kind: args.kind,
          subject: args.subject,
          body: args.body,
          targetType: args.targetType,
          targetId: args.targetId,
          idempotencyKey: keyFor("push"),
        });
        if (!rec) continue; // already dispatched (dedupe)
        const { id } = rec;

        const payload: PushPayload = {
          title: args.subject,
          body: args.body,
          url: args.url ?? targetUrl(args.targetType, args.targetId),
          tag: args.targetId ?? args.kind,
        };
        let anyOk = false;
        let lastError: string | undefined;
        for (const sub of subs) {
          const r = await sendWebPush(sub, payload);
          if (r.ok) anyOk = true;
          else {
            lastError = r.error;
            if (r.gone) {
              if (isTenant) await pruneTenantPushSubscription(tx, sub.id);
              else await prunePushSubscription(tx, sub.id);
            }
          }
        }
        // Native APNs to the tenant's iOS devices (stub no-op until APNs keyed).
        for (const dt of deviceTokens) {
          const r = await sendApns(dt.token, payload);
          if (r.ok) anyOk = true;
          else {
            lastError = r.error;
            if (r.gone) await pruneTenantDeviceToken(tx, dt.id);
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
        const rec = await recordNotification(tx, {
          orgId: args.orgId,
          recipientUserId: args.recipientUserId,
          recipientVendorUserId: args.recipientVendorUserId,
          recipientTenantUserId: args.recipientTenantUserId,
          channel: "in_app",
          kind: args.kind,
          subject: args.subject,
          body: args.body,
          targetType: args.targetType,
          targetId: args.targetId,
          idempotencyKey: keyFor("in_app"),
        });
        if (!rec) continue; // already dispatched (dedupe)
        await markNotificationStatus(tx, rec.id, { status: "sent" });
        sent.push("in_app");
        continue;
      }

      const rec = await recordNotification(tx, {
        orgId: args.orgId,
        recipientUserId: args.recipientUserId,
        recipientVendorUserId: args.recipientVendorUserId,
        recipientTenantUserId: args.recipientTenantUserId,
        channel,
        kind: args.kind,
        subject: args.subject,
        body: args.body,
        targetType: args.targetType,
        targetId: args.targetId,
        idempotencyKey: keyFor(channel),
      });
      if (!rec) continue; // already dispatched (dedupe)
      const { id } = rec;

      try {
        if (channel === "email" && args.recipientEmail) {
          // Branded template + an absolute deep link (EML templates/deep links).
          const deepLink = args.url ?? targetUrl(args.targetType, args.targetId);
          const { html, text } = renderNotificationEmail({
            heading: args.subject,
            body: args.body,
            url: absoluteUrl(deepLink),
          });
          const r = await sendEmail({
            to: args.recipientEmail,
            subject: args.subject,
            html,
            text,
          });
          await markNotificationStatus(tx, id, {
            status: "sent",
            providerMessageId: r.id,
          });
          sent.push("email");
        } else if (channel === "sms" && args.recipientPhone) {
          // Real Twilio send when configured; stubs (id=null) otherwise. A
          // real-send error throws → the outer catch marks this failed.
          // Brand the body so the text self-identifies as Stack — US 10DLC
          // can't set a sender name, so this is the only place to brand it.
          const r = await sendSms({
            to: args.recipientPhone,
            body: `Stack OS · ${args.subject} — ${args.body}`,
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
