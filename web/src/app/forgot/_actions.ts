"use server";

import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/lib/server/password-reset";
import { rateLimit, clientIp } from "@/lib/server/rate-limit";

/** Operator/technician requests a reset email. Rate-limited per IP; generic
 *  redirect — never reveals whether the email is registered. */
export async function requestStaffReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const { allowed } = await rateLimit(`reset:ip:${await clientIp()}`, 8, 15 * 60 * 1000);
  if (allowed && email) await requestPasswordReset("staff", email);
  redirect("/forgot?sent=1");
}
