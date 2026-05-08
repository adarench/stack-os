"use server";
import { revalidatePath } from "next/cache";
import { decideApproval } from "@/lib/server/approvals";

export async function decideApprovalAction(formData: FormData): Promise<void> {
  await decideApproval({
    id: String(formData.get("id")),
    to: (formData.get("to") as "approved" | "rejected") ?? "approved",
    notes: String(formData.get("notes") ?? "") || undefined,
  });
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/financials");
}
