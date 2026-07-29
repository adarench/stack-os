"use server";

import { redirect } from "next/navigation";
import { verifyTenantCredentials } from "@/lib/server/tenant-credentials";
import { setTenantSessionCookie } from "@/lib/server/tenant-auth";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { recordAuthEvent } from "@/lib/server/auth-events";

/**
 * Resident email + password sign-in. Generic error on failure (never reveals
 * whether the email exists). Rate-limited per IP + per email (brute-force),
 * audited on success/failure. On success, sets the session cookie and enters.
 */
export async function signInTenant(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const ip = await clientIp();

  const ipOk = await rateLimit(`login:ip:${ip}`, 20, 10 * 60 * 1000);
  const emailOk = await rateLimit(`login:tenant:${email.toLowerCase()}`, 10, 10 * 60 * 1000);
  if (!ipOk.allowed || !emailOk.allowed) {
    await recordAuthEvent({ event: "login_failed", actorType: "tenant", subjectEmail: email, ip, meta: { reason: "rate_limited" } });
    redirect("/tenant/sign-in?error=rate_limited");
  }

  // STACK_ORG_ID is only a hint — the org is resolved from the email, so login
  // works even when the pin is unset (which it is on this deployment).
  const user = await verifyTenantCredentials(process.env.STACK_ORG_ID ?? null, email, password);
  if (!user) {
    await recordAuthEvent({ event: "login_failed", actorType: "tenant", subjectEmail: email, ip });
    redirect("/tenant/sign-in?error=bad_credentials");
  }

  await recordAuthEvent({ event: "login_ok", orgId: user.orgId, actorType: "tenant", subjectTenantUserId: user.tenantUserId, subjectEmail: email, ip });
  await setTenantSessionCookie({ orgId: user.orgId, tenantUserId: user.tenantUserId });
  redirect("/tenant");
}
