"use server";

import { redirect } from "next/navigation";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { setOwnTenantPassword } from "@/lib/server/tenant-credentials";
import { passwordMeetsPolicy } from "@/lib/server/password";

/** Resident sets their own password after signing in with a temporary one. */
export async function changeOwnTenantPassword(formData: FormData): Promise<void> {
  const session = await readTenantSession();
  if (!session) redirect("/tenant/sign-in");
  const pw = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (pw !== confirm) redirect("/tenant/change-password?error=mismatch");
  if (!passwordMeetsPolicy(pw)) redirect("/tenant/change-password?error=weak");
  await setOwnTenantPassword(session, pw);
  redirect("/tenant");
}
