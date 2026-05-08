import { NextResponse } from "next/server";
import { consumeTenantMagicLink } from "@/lib/server/tenant-invite";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || token.length < 16) {
    return NextResponse.redirect(new URL("/tenant/invalid", _req.url));
  }
  const session = await consumeTenantMagicLink(token);
  if (!session) {
    return NextResponse.redirect(new URL("/tenant/invalid", _req.url));
  }
  return NextResponse.redirect(new URL("/tenant", _req.url));
}
