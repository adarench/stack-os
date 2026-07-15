import { NextResponse } from "next/server";
import { clearTenantSession } from "@/lib/server/tenant-auth";

export const dynamic = "force-dynamic";

function baseUrl(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

export async function GET(req: Request) {
  await clearTenantSession();
  return NextResponse.redirect(new URL("/tenant/sign-in", baseUrl(req)));
}
