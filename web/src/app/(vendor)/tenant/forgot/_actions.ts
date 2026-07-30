"use server";

import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/lib/server/password-reset";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { recordAuthEvent } from "@/lib/server/auth-events";

/** Resident requests a reset email. Rate-limited per IP; always redirects to the
 *  same "check your email" state — never reveals whether the email is registered
 *  (even when throttled). The lookup spans resident *and* staff accounts, so a
 *  tech who lands here still gets their reset link (see requestPasswordReset). */
export async function requestTenantReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const ip = await clientIp();
  const { allowed } = await rateLimit(`reset:ip:${ip}`, 8, 15 * 60 * 1000);
  if (allowed && email) await requestPasswordReset("tenant", email);
  // A throttled request looks exactly like a sent one to the user. Audit it so
  // "I never got the email" has an answer — a whole building shares one NAT IP.
  else if (!allowed) await recordAuthEvent({ event: "reset_rate_limited", actorType: "system", subjectEmail: email || null, ip, meta: { surface: "tenant" } });
  redirect("/tenant/forgot?sent=1");
}
