import { NextResponse, type NextRequest } from "next/server";
import { withStaffScope } from "@/lib/server/db";
import { ensureUserRow } from "@/lib/server/sync-user";
import { savePushSubscription, prunePushSubscription } from "@/lib/server/push";
import { and, eq } from "drizzle-orm";
import { pushSubscriptions } from "@db/schema/push-subscriptions";

/**
 * Register / refresh a web-push subscription for the signed-in staff user.
 *
 *   POST   /api/me/push/subscribe   body: PushSubscription.toJSON()
 *   DELETE /api/me/push/subscribe   body: { endpoint }   (unsubscribe)
 *
 * The browser produces the subscription via the service worker + VAPID public
 * key; we persist endpoint + keys so the notification dispatcher can send.
 */
export async function POST(req: NextRequest) {
  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "endpoint and keys.{p256dh,auth} are required" },
      { status: 400 },
    );
  }

  const userAgent = req.headers.get("user-agent");

  await withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    await savePushSubscription(tx, {
      orgId: ctx.orgId,
      userId,
      endpoint,
      p256dh,
      auth,
      userAgent,
    });
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const endpoint = body.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }

  await withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.orgId, ctx.orgId),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      )
      .limit(1);
    if (rows[0]) await prunePushSubscription(tx, rows[0].id);
  });

  return NextResponse.json({ ok: true });
}
