"use server";
import { revalidatePath } from "next/cache";
import { transitionInvoice, submitInvoiceAsStaff } from "@/lib/server/invoices";
import type { InvoiceStatus } from "@contracts/financials";

export async function transitionInvoiceAction(formData: FormData): Promise<void> {
  await transitionInvoice({
    id: String(formData.get("id")),
    to: String(formData.get("to")) as InvoiceStatus,
  });
  revalidatePath("/admin/financials");
}

export async function staffSubmitInvoiceAction(formData: FormData): Promise<void> {
  await submitInvoiceAsStaff({
    vendorId: String(formData.get("vendorId")),
    workOrderId: String(formData.get("workOrderId") ?? "") || undefined,
    invoiceNumber: String(formData.get("invoiceNumber") ?? "") || undefined,
    totalCents: Number(formData.get("totalCents") ?? 0),
    notes: String(formData.get("notes") ?? "") || undefined,
  });
  revalidatePath("/admin/financials");
  revalidatePath("/admin/approvals");
}
