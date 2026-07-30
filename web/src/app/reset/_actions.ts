"use server";

import { redirect } from "next/navigation";
import { completePasswordReset } from "@/lib/server/password-reset";

/** Complete an operator/technician password reset from the emailed token. */
export async function completeStaffReset(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) redirect(`/reset?token=${encodeURIComponent(token)}&error=mismatch`);

  const r = await completePasswordReset("staff", token, password);
  if (!r.ok) redirect(`/reset?token=${encodeURIComponent(token)}&error=${r.error ?? "invalid"}`);
  // A resident token can legitimately be redeemed here; send them to their own
  // sign-in rather than the ops one they'd never get through.
  redirect(r.actor === "tenant" ? "/tenant/sign-in?reset=1" : "/sign-in?reset=1");
}
