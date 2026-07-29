"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth";
import { setOwnStaffPassword } from "@/lib/server/credentials";
import { passwordMeetsPolicy } from "@/lib/server/password";

/** Operator/technician sets their own password after signing in with a temp one. */
export async function changeOwnStaffPassword(formData: FormData): Promise<void> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect("/sign-in");
  const pw = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (pw !== confirm) redirect("/change-password?error=mismatch");
  if (!passwordMeetsPolicy(pw)) redirect("/change-password?error=weak");
  await setOwnStaffPassword(orgId, userId, pw);
  redirect("/");
}
