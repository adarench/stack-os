import { NextResponse } from "next/server";
import { z } from "zod";
import { readTenantSession } from "@/lib/server/tenant-auth";
import {
  registerTenantDeviceToken,
  unregisterTenantDeviceToken,
} from "@/lib/server/tenant-work-orders";

const body = z.object({
  token: z.string().min(1).max(400),
  platform: z.enum(["ios", "android"]).default("ios"),
});

/** Register the resident's native APNs device token (tenant-session gated). */
export async function POST(req: Request) {
  const session = await readTenantSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let parsed;
  try {
    parsed = body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  await registerTenantDeviceToken(session, {
    token: parsed.token,
    platform: parsed.platform,
    userAgent: req.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true });
}

/** Drop this device's token (sign-out) so it stops receiving pushes. */
export async function DELETE(req: Request) {
  const session = await readTenantSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let token: string | undefined;
  try {
    token = (await req.json())?.token;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  await unregisterTenantDeviceToken(session, token);
  return NextResponse.json({ ok: true });
}
