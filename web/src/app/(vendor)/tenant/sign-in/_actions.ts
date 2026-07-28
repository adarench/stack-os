"use server";

import { redirect } from "next/navigation";
import { verifyTenantCredentials } from "@/lib/server/tenant-credentials";
import { setTenantSessionCookie } from "@/lib/server/tenant-auth";

/**
 * Resident email + password sign-in. Single-org deployment, so the org is the
 * pinned STACK_ORG_ID. Generic error on failure (never reveals whether the
 * email exists). On success, sets the tenant session cookie and enters the portal.
 */
export async function signInTenant(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // STACK_ORG_ID is only a hint — the org is resolved from the email, so login
  // works even when the pin is unset (which it is on this deployment).
  const user = await verifyTenantCredentials(process.env.STACK_ORG_ID ?? null, email, password);
  if (!user) redirect("/tenant/sign-in?error=bad_credentials");

  await setTenantSessionCookie({ orgId: user.orgId, tenantUserId: user.tenantUserId });
  redirect("/tenant");
}
