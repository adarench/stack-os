import "server-only";
import webpush from "web-push";
import { and, eq, isNull } from "drizzle-orm";
import { pushSubscriptions, tenantPushSubscriptions } from "@db/schema/push-subscriptions";
import type { ScopedDB } from "./db";

/**
 * Web-push delivery. Mirrors the email.ts pattern: if VAPID keys are not
 * configured, calls log + resolve successfully so local dev, tests, and
 * credential-less builds never break. Production sets the two VAPID env vars.
 *
 * Generate a key pair once with: `npx web-push generate-vapid-keys`.
 *   VAPID_PUBLIC_KEY            — also exposed to the client as
 *                                 NEXT_PUBLIC_VAPID_PUBLIC_KEY (must match)
 *   VAPID_PRIVATE_KEY           — server only
 *   VAPID_SUBJECT              — "mailto:ops@yourdomain" (optional)
 */
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? "mailto:ops@example.com";

let configured = false;
if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export const pushConfigured = (): boolean => configured;

export interface PushPayload {
  title: string;
  body: string;
  /** In-app deep link opened on notification click. */
  url?: string;
  /** Coalescing tag so repeated pushes about the same entity collapse. */
  tag?: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send one web-push message. Returns `gone: true` when the push service
 * reports the subscription is expired/unsubscribed (HTTP 404/410) so the
 * caller can prune the row.
 */
export async function sendWebPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<{ ok: boolean; gone: boolean; error?: string }> {
  if (!configured) {
    // eslint-disable-next-line no-console
    console.log("[push:stub]", payload.title, "→", target.endpoint.slice(0, 48));
    return { ok: true, gone: false };
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify(payload),
    );
    return { ok: true, gone: false };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    const gone = status === 404 || status === 410;
    return { ok: false, gone, error: (e as Error).message.slice(0, 300) };
  }
}

/** Active (non-deleted) push subscriptions for a staff user. */
export async function loadPushSubscriptions(
  tx: ScopedDB,
  orgId: string,
  userId: string,
): Promise<Array<{ id: string } & PushTarget>> {
  const rows = await tx
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.orgId, orgId),
        eq(pushSubscriptions.userId, userId),
        isNull(pushSubscriptions.deletedAt),
      ),
    );
  return rows;
}

/**
 * Upsert a subscription by endpoint. Re-subscribing from the same browser
 * refreshes its keys instead of inserting a duplicate.
 */
export async function savePushSubscription(
  tx: ScopedDB,
  input: {
    orgId: string;
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  },
): Promise<void> {
  await tx
    .insert(pushSubscriptions)
    .values({
      orgId: input.orgId,
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
}

/** Soft-prune a subscription the push service reported as gone. */
export async function prunePushSubscription(
  tx: ScopedDB,
  id: string,
): Promise<void> {
  await tx
    .update(pushSubscriptions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(pushSubscriptions.id, id));
}

/* -------------------- tenant (resident) push -------------------- */

/** Active push subscriptions for a tenant (resident) user. */
export async function loadTenantPushSubscriptions(
  tx: ScopedDB,
  orgId: string,
  tenantUserId: string,
): Promise<Array<{ id: string } & PushTarget>> {
  return tx
    .select({
      id: tenantPushSubscriptions.id,
      endpoint: tenantPushSubscriptions.endpoint,
      p256dh: tenantPushSubscriptions.p256dh,
      auth: tenantPushSubscriptions.auth,
    })
    .from(tenantPushSubscriptions)
    .where(
      and(
        eq(tenantPushSubscriptions.orgId, orgId),
        eq(tenantPushSubscriptions.tenantUserId, tenantUserId),
        isNull(tenantPushSubscriptions.deletedAt),
      ),
    );
}

/** Upsert a tenant subscription by endpoint (refresh on re-subscribe). */
export async function saveTenantPushSubscription(
  tx: ScopedDB,
  input: {
    orgId: string;
    tenantUserId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  },
): Promise<void> {
  await tx
    .insert(tenantPushSubscriptions)
    .values({
      orgId: input.orgId,
      tenantUserId: input.tenantUserId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: tenantPushSubscriptions.endpoint,
      set: {
        tenantUserId: input.tenantUserId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
}

/** Soft-prune a tenant subscription the push service reported as gone. */
export async function pruneTenantPushSubscription(
  tx: ScopedDB,
  id: string,
): Promise<void> {
  await tx
    .update(tenantPushSubscriptions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(tenantPushSubscriptions.id, id));
}
