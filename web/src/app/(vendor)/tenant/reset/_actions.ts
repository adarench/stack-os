"use server";

import { redirect } from "next/navigation";
import { completePasswordReset } from "@/lib/server/password-reset";

/** Complete a resident password reset from the emailed token. */
export async function completeTenantReset(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) redirect(`/tenant/reset?token=${encodeURIComponent(token)}&error=mismatch`);

  const r = await completePasswordReset("tenant", token, password);
  if (!r.ok) {
    redirect(`/tenant/reset?token=${encodeURIComponent(token)}&error=${r.error ?? "invalid"}`);
  }
  redirect("/tenant/sign-in?reset=1");
}
