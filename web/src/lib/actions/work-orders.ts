"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createWorkOrder,
  type CreateWorkOrderInput,
  updateWorkOrderStatus,
  assignVendor,
} from "@/lib/server/work-orders";
import type { WorkOrderStatus } from "@contracts/state-machines/work-order";
import { createComment } from "@/lib/server/comments";
import { createAttachment } from "@/lib/server/attachments";
import { signUploadUrl, storageConfigured } from "@/lib/server/storage";
import { addCost } from "@/lib/server/costs";
import { auth } from "@clerk/nextjs/server";
import { COST_KINDS, type CostKind } from "@contracts/financials";

export async function createWorkOrderAction(input: CreateWorkOrderInput) {
  const row = await createWorkOrder(input);
  revalidatePath("/work");
  revalidatePath("/now");
  redirect(`/work?d=WO-${row.number}`);
}

export async function transitionStatusAction(formData: FormData) {
  const id = String(formData.get("id"));
  const to = String(formData.get("to"));
  await updateWorkOrderStatus({ id, to: to as never });
  revalidatePath("/work");
  revalidatePath("/now");
}

/**
 * Used by the kanban board on individual moves. Throws on invalid
 * transition; the client pre-checks via `canTransition` so this is a
 * defense-in-depth.
 */
export async function moveWorkOrderAction(
  id: string,
  to: WorkOrderStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await updateWorkOrderStatus({ id, to });
    revalidatePath("/work");
    revalidatePath("/now");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Batch status transition for the keyboard-driven kanban (replaces
 * drag-drop). Each card transitions individually so each gets its own
 * audit row, but the batch surfaces a single failure: if any card has
 * an invalid transition, the entire batch reports failure with the first
 * offending ref. Cards before the failure are already moved — this is
 * an at-most-N-1 partial outcome by design. The client UI dismisses the
 * action bar on success and reports the failure inline on partial.
 */
export async function batchSetStatusAction(
  ids: string[],
  to: WorkOrderStatus,
): Promise<
  | { ok: true; moved: number }
  | { ok: false; moved: number; error: string; failedId: string }
> {
  let moved = 0;
  for (const id of ids) {
    try {
      await updateWorkOrderStatus({ id, to });
      moved += 1;
    } catch (err) {
      revalidatePath("/work");
      revalidatePath("/now");
      return {
        ok: false,
        moved,
        error: (err as Error).message,
        failedId: id,
      };
    }
  }
  revalidatePath("/work");
  revalidatePath("/now");
  return { ok: true, moved };
}

export async function addCommentAction(formData: FormData) {
  const targetId = String(formData.get("targetId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await createComment({ targetType: "work_order", targetId, body, visibility: "internal" });
  revalidatePath("/work");
  revalidatePath("/now");
}

export async function assignVendorAction(formData: FormData) {
  const workOrderId = String(formData.get("workOrderId"));
  const vendorUserId = String(formData.get("vendorUserId"));
  if (!vendorUserId) return;
  await assignVendor({ workOrderId, vendorUserId });
  revalidatePath("/work");
  revalidatePath("/now");
}

export interface SignedUploadResult {
  url: string;
  key: string;
  expiresInSeconds: number;
}

export async function requestUploadUrl(args: {
  targetType: "work_order";
  targetId: string;
  filename: string;
  contentType: string;
}): Promise<SignedUploadResult | { error: string }> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { error: "unauthorized" };
  if (!storageConfigured()) return { error: "storage_not_configured" };
  return signUploadUrl({ orgId, ...args });
}

export async function addCostAction(formData: FormData): Promise<void> {
  const workOrderId = String(formData.get("workOrderId"));
  const kind = String(formData.get("kind") ?? "other") as CostKind;
  await addCost({
    workOrderId,
    kind: COST_KINDS.includes(kind) ? kind : "other",
    description: String(formData.get("description") ?? "") || undefined,
    amountCents: Number(formData.get("amountCents") ?? 0),
  });
  revalidatePath("/work");
  revalidatePath("/now");
}

export async function attachUploadedFileAction(input: {
  targetType: "work_order";
  targetId: string;
  storageKey: string;
  contentType: string;
  filename?: string;
  sizeBytes?: number;
  kind?: "before_photo" | "after_photo" | "receipt" | "general";
}) {
  await createAttachment({
    targetType: input.targetType,
    targetId: input.targetId,
    storageKey: input.storageKey,
    contentType: input.contentType,
    filename: input.filename,
    sizeBytes: input.sizeBytes,
    kind: input.kind ?? "general",
  });
  revalidatePath("/work");
  revalidatePath("/now");
}
