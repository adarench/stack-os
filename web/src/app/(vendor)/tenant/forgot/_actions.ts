"use server";

import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/lib/server/password-reset";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";

/** Resident requests a reset email. Rate-limited per IP; always redirects to the
 *  same "check your email" state — never reveals whether the email is registered
 *  (even when throttled). */
export async function requestTenantReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const { allowed } = await rateLimit(`reset:ip:${await clientIp()}`, 8, 15 * 60 * 1000);
  if (allowed && email) await requestPasswordReset("tenant", email);
  redirect("/tenant/forgot?sent=1");
}
