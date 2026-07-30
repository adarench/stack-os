"use server";

import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/lib/server/password-reset";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";
import { recordAuthEvent } from "@/lib/server/auth-events";

/** Operator/technician requests a reset email. Rate-limited per IP; generic
 *  redirect — never reveals whether the email is registered. The lookup itself
 *  spans staff *and* resident accounts, so landing on the wrong reset page is
 *  no longer a silent dead end (see requestPasswordReset). */
export async function requestStaffReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const ip = await clientIp();
  const { allowed } = await rateLimit(`reset:ip:${ip}`, 8, 15 * 60 * 1000);
  if (allowed && email) await requestPasswordReset("staff", email);
  // A throttled request looks exactly like a sent one to the user. Audit it so
  // "I never got the email" has an answer — a whole office shares one NAT IP.
  else if (!allowed) await recordAuthEvent({ event: "reset_rate_limited", actorType: "system", subjectEmail: email || null, ip, meta: { surface: "staff" } });
  redirect("/forgot?sent=1");
}
