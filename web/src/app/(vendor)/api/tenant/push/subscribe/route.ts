import { NextResponse } from "next/server";
import { z } from "zod";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { subscribeTenantPush } from "@/lib/server/tenant-work-orders";

const body = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

/** Register a resident's web-push subscription (tenant-session gated). */
export async function POST(req: Request) {
  const session = await readTenantSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let parsed;
  try {
    parsed = body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  await subscribeTenantPush(session, {
    endpoint: parsed.endpoint,
    p256dh: parsed.keys.p256dh,
    auth: parsed.keys.auth,
    userAgent: req.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true });
}
