import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForEmail, findTenantByEmail } from "@/lib/server/tenant-google";
import { setTenantSessionCookie } from "@/lib/server/tenant-auth";

export const dynamic = "force-dynamic";

function baseUrl(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const base = baseUrl(req);

  const c = await cookies();
  const cookieState = c.get("tenant_oauth_state")?.value;
  c.delete("tenant_oauth_state");

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/tenant/sign-in?error=${reason}`, base));

  // CSRF: the returned state must match the one we stashed pre-redirect.
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("state");
  }

  const redirectUri = `${base}/api/tenant/auth/google/callback`;
  const result = await exchangeCodeForEmail(code, redirectUri);
  if (!result || !result.emailVerified) return fail("google");

  // Allowlist = the tenant roster. No matching invited email → no access.
  const session = await findTenantByEmail(result.email);
  if (!session) return fail("not_registered");

  await setTenantSessionCookie(session);
  return NextResponse.redirect(new URL("/tenant", base));
}
