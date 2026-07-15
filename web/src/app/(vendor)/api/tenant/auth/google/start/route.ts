import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { buildGoogleAuthUrl } from "@/lib/server/tenant-google";

export const dynamic = "force-dynamic";

/** External base URL the user actually hit (must match the registered redirect URI). */
function baseUrl(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

export async function GET(req: Request) {
  const state = randomBytes(16).toString("base64url");
  const redirectUri = `${baseUrl(req)}/api/tenant/auth/google/callback`;

  const c = await cookies();
  c.set("tenant_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/tenant/auth/google",
    maxAge: 600,
  });

  return NextResponse.redirect(buildGoogleAuthUrl(redirectUri, state));
}
