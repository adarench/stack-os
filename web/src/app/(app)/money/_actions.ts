"use server";
import { revalidatePath } from "next/cache";
import { decideApproval } from "@/lib/server/approvals";
import { transitionInvoice, submitInvoiceAsStaff } from "@/lib/server/invoices";
import type { InvoiceStatus } from "@contracts/financials";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Toast-friendly variant of decideApprovalAction. Returns a result instead
 * of redirecting, so the client component can render a `toast.success` /
 * `toast.error` and keep the operator on /money.
 */
export async function decideApprovalActionResult(
  id: string,
  to: "approved" | "rejected",
  notes?: string,
): Promise<ActionResult> {
  try {
    await decideApproval({ id, to, notes });
    revalidatePath("/money");
    revalidatePath("/now");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/** Staff/manager invoice status transition (Invoices tab, folded in from the
 *  old /admin/financials console). */
export async function transitionInvoiceAction(formData: FormData): Promise<void> {
  await transitionInvoice({
    id: String(formData.get("id")),
    to: String(formData.get("to")) as InvoiceStatus,
  });
  revalidatePath("/money");
}

/** Staff data-entry of a vendor invoice (Invoices tab). */
export async function staffSubmitInvoiceAction(formData: FormData): Promise<void> {
  await submitInvoiceAsStaff({
    vendorId: String(formData.get("vendorId")),
    workOrderId: String(formData.get("workOrderId") ?? "") || undefined,
    invoiceNumber: String(formData.get("invoiceNumber") ?? "") || undefined,
    totalCents: Number(formData.get("totalCents") ?? 0),
    notes: String(formData.get("notes") ?? "") || undefined,
  });
  revalidatePath("/money");
}
