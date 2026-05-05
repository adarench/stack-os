import { NextResponse } from "next/server";
import { consumeMagicLinkAndStartSession } from "@/lib/server/vendor-invite";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || token.length < 16) {
    return NextResponse.redirect(new URL("/vendor/invalid", _req.url));
  }
  const session = await consumeMagicLinkAndStartSession(token);
  if (!session) {
    return NextResponse.redirect(new URL("/vendor/invalid", _req.url));
  }
  return NextResponse.redirect(new URL("/vendor", _req.url));
}
