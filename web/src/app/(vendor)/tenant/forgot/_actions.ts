"use server";

import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/lib/server/password-reset";

/** Resident requests a reset email. Always redirects to the same "check your
 *  email" state — never reveals whether the email is registered. */
export async function requestTenantReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  if (email) await requestPasswordReset("tenant", email);
  redirect("/tenant/forgot?sent=1");
}
