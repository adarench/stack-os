"use server";

import { revalidatePath } from "next/cache";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { recordTenantInsuranceFromPortal } from "@/lib/server/tenant-insurance";

export async function recordTenantInsuranceFromPortalAction(
  formData: FormData,
): Promise<void> {
  const session = await readTenantSession();
  if (!session) return;
  const expiresStr = String(formData.get("expiresAt") ?? "");
  const effectiveStr = String(formData.get("effectiveAt") ?? "");
  await recordTenantInsuranceFromPortal(session, {
    policyNumber: String(formData.get("policyNumber") ?? "") || undefined,
    carrier: String(formData.get("carrier") ?? "") || undefined,
    effectiveAt: effectiveStr ? new Date(effectiveStr) : undefined,
    expiresAt: expiresStr ? new Date(expiresStr) : undefined,
  });
  revalidatePath("/tenant");
}
