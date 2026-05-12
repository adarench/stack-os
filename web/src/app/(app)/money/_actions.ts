"use server";
import { revalidatePath } from "next/cache";
import { decideApproval } from "@/lib/server/approvals";

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
