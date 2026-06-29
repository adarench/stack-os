"use server";

import { revalidatePath } from "next/cache";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { recordTenantInsuranceFromPortal } from "@/lib/server/tenant-insurance";
import {
  createWorkOrderFromTenant,
  attachTenantUpload,
  createTenantComment,
  type TenantSubmitInput,
} from "@/lib/server/tenant-work-orders";

export type CreateTenantRequestResult =
  | { ok: true; id: string; ref: string }
  | { ok: false; error: string };

export async function createTenantRequestAction(
  input: TenantSubmitInput,
): Promise<CreateTenantRequestResult> {
  const session = await readTenantSession();
  if (!session) return { ok: false, error: "not_signed_in" };
  try {
    const row = await createWorkOrderFromTenant(session, input);
    revalidatePath("/tenant");
    return { ok: true, id: row.id, ref: `WO-${row.number}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function attachTenantUploadAction(input: {
  workOrderId: string;
  storageKey: string;
  contentType: string;
  filename?: string;
  sizeBytes?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await readTenantSession();
  if (!session) return { ok: false, error: "not_signed_in" };
  try {
    await attachTenantUpload(session, input);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function sendTenantMessageAction(
  ref: string,
  workOrderId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await readTenantSession();
  if (!session) return { ok: false, error: "not_signed_in" };
  if (!body.trim()) return { ok: false, error: "empty" };
  try {
    await createTenantComment(session, { workOrderId, body: body.trim() });
    revalidatePath(`/tenant/${ref}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

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
  revalidatePath("/tenant/insurance");
}
