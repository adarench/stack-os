"use server";

import { revalidatePath } from "next/cache";
import { readVendorSession } from "@/lib/server/vendor-auth";
import { loadVendorWorkOrder, vendorPostMessage } from "@/lib/server/vendor-work-orders";

/**
 * Vendor posts a message on an assigned WO (M9). Resolves the WO id from the
 * ref under the vendor's own session so the id is never trusted from the form;
 * `vendorPostMessage` + RLS enforce the assignment.
 */
export async function postVendorMessage(ref: string, formData: FormData): Promise<void> {
  const session = await readVendorSession();
  if (!session) return;
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const wo = await loadVendorWorkOrder(session, ref);
  if (!wo) return; // not assigned / no such WO

  await vendorPostMessage(session, { workOrderId: wo.id, body });
  revalidatePath(`/vendor/${ref}`);
}
