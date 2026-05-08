"use server";

import { revalidatePath } from "next/cache";
import { recordCoi } from "@/lib/server/coi";
import { recordTenantInsurance } from "@/lib/server/tenant-insurance";
import { inviteTenantUser } from "@/lib/server/tenant-invite";

export async function recordCoiAction(formData: FormData): Promise<void> {
  const expiresStr = String(formData.get("expiresAt") ?? "");
  const effectiveStr = String(formData.get("effectiveAt") ?? "");
  const coverageStr = String(formData.get("coverageAmountCents") ?? "");
  await recordCoi({
    vendorId: String(formData.get("vendorId")),
    policyNumber: String(formData.get("policyNumber") ?? "") || undefined,
    carrier: String(formData.get("carrier") ?? "") || undefined,
    coverageAmountCents: coverageStr ? Number(coverageStr) : undefined,
    effectiveAt: effectiveStr ? new Date(effectiveStr) : undefined,
    expiresAt: expiresStr ? new Date(expiresStr) : undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
  });
  revalidatePath("/admin/compliance/cois");
  revalidatePath("/admin/vendors");
}

export async function recordTenantInsuranceAction(formData: FormData): Promise<void> {
  const expiresStr = String(formData.get("expiresAt") ?? "");
  const effectiveStr = String(formData.get("effectiveAt") ?? "");
  const coverageStr = String(formData.get("coverageAmountCents") ?? "");
  await recordTenantInsurance({
    tenantUserId: String(formData.get("tenantUserId")),
    policyNumber: String(formData.get("policyNumber") ?? "") || undefined,
    carrier: String(formData.get("carrier") ?? "") || undefined,
    coverageAmountCents: coverageStr ? Number(coverageStr) : undefined,
    effectiveAt: effectiveStr ? new Date(effectiveStr) : undefined,
    expiresAt: expiresStr ? new Date(expiresStr) : undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
  });
  revalidatePath("/admin/compliance/tenants");
}

export async function inviteTenantUserAction(formData: FormData): Promise<void> {
  const r = await inviteTenantUser({
    unitId: String(formData.get("unitId")),
    email: String(formData.get("email")),
    name: String(formData.get("name") ?? "") || undefined,
    phone: String(formData.get("phone") ?? "") || undefined,
  });
  // eslint-disable-next-line no-console
  console.log("[invite/tenant] tenant_user_id=%s url=%s", r.tenantUserId, r.inviteUrl);
  revalidatePath("/admin/compliance/tenants");
}
