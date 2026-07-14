"use server";

import { revalidatePath } from "next/cache";
import { recordCoi } from "@/lib/server/coi";
import { createVendor } from "@/lib/server/vendors";
import { recordTenantInsurance } from "@/lib/server/tenant-insurance";
import { inviteTenantUser } from "@/lib/server/tenant-invite";

export interface RecordCoiInput {
  /** An existing vendor id, or the "__other__" sentinel to create one. */
  vendorId?: string;
  /** Name for the new vendor when vendorId is "__other__". */
  newVendorName?: string;
  policyNumber?: string;
  carrier?: string;
  coverageAmountCents?: number;
  effectiveAt?: string;
  expiresAt?: string;
  notes?: string;
  /** A PDF already uploaded to storage via the sign route. */
  upload?: {
    storageKey: string;
    contentType: string;
    filename?: string;
    sizeBytes?: number;
  };
}

export async function recordCoiAction(
  input: RecordCoiInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    let vendorId = input.vendorId?.trim();
    if (vendorId === "__other__") {
      const name = input.newVendorName?.trim();
      if (!name) return { ok: false, error: "vendor_name_required" };
      const vendor = await createVendor({ name });
      vendorId = vendor.id;
    }
    if (!vendorId) return { ok: false, error: "vendor_required" };

    await recordCoi({
      vendorId,
      policyNumber: input.policyNumber || undefined,
      carrier: input.carrier || undefined,
      coverageAmountCents:
        input.coverageAmountCents != null && !Number.isNaN(input.coverageAmountCents)
          ? input.coverageAmountCents
          : undefined,
      effectiveAt: input.effectiveAt ? new Date(input.effectiveAt) : undefined,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      notes: input.notes || undefined,
      upload: input.upload,
    });
    revalidatePath("/admin/compliance/cois");
    revalidatePath("/admin/vendors");
    revalidatePath("/vendors");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
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
  revalidatePath("/vendors");
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
  revalidatePath("/vendors");
}
