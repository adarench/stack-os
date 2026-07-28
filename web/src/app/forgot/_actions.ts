"use server";

import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/lib/server/password-reset";

/** Operator/technician requests a reset email. Generic redirect — never reveals
 *  whether the email is registered. */
export async function requestStaffReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  if (email) await requestPasswordReset("staff", email);
  redirect("/forgot?sent=1");
}
