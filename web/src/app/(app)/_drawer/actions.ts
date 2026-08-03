"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createComment } from "@/lib/server/comments";
import { updateWorkOrderStatus, assignVendor, assignTechnician } from "@/lib/server/work-orders";
import { decideApproval } from "@/lib/server/approvals";
import { loadEntityDetail } from "@/lib/server/entity-detail";

/* ------------------ comment ------------------ */

const addCommentInput = z.object({
  ref: z.string(),
  body: z.string().min(1).max(10_000),
  visibility: z.enum(["internal", "external"]).default("internal"),
});

export async function addCommentAction(input: z.input<typeof addCommentInput>) {
  const parsed = addCommentInput.parse(input);
  const detail = await loadEntityDetail(parsed.ref);
  if (!detail) {
    return { ok: false as const, error: "entity_not_found" };
  }
  // Comments always thread against the underlying entity. For approvals,
  // that's the linked WO; the approval row itself doesn't carry comments.
  const target =
    detail.type === "approval" && detail.linkedWo
      ? {
          type: "work_order" as const,
          id: await resolveWoId(detail.linkedWo.ref),
        }
      : { type: targetTypeFor(detail.type), id: detail.id };

  if (!target.id) {
    return { ok: false as const, error: "no_linked_target" };
  }

  await createComment({
    targetType: target.type,
    targetId: target.id,
    body: parsed.body,
    visibility: parsed.visibility,
  });
  revalidatePath("/now");
  revalidatePath("/work");
  return { ok: true as const };
}

/* ------------------ status ------------------ */

const setStatusInput = z.object({
  ref: z.string(),
  to: z.string(),
  // LIF-007: when blocking, who it's waiting on — drives the "Waiting on" field
  // and the tenant-facing split ("Waiting on you" vs "On hold").
  blockedReason: z.enum(["waiting_tenant", "waiting_vendor", "other"]).optional(),
});

export async function setStatusAction(input: z.input<typeof setStatusInput>) {
  const parsed = setStatusInput.parse(input);
  const detail = await loadEntityDetail(parsed.ref);
  if (!detail || detail.type !== "wo") {
    return { ok: false as const, error: "not_a_work_order" };
  }
  try {
    await updateWorkOrderStatus({
      id: detail.id,
      to: parsed.to as never,
      blockedReason: parsed.blockedReason,
    });
    revalidatePath("/now");
    revalidatePath("/work");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "transition_failed",
    };
  }
}

/* ------------------ assign vendor ------------------ */

const assignVendorInput = z.object({
  ref: z.string(),
  vendorUserId: z.string().uuid(),
  overrideCoi: z.boolean().optional(),
});

export async function assignVendorAction(
  input: z.input<typeof assignVendorInput>,
) {
  const parsed = assignVendorInput.parse(input);
  const detail = await loadEntityDetail(parsed.ref);
  if (!detail || detail.type !== "wo") {
    return { ok: false as const, error: "not_a_work_order" };
  }
  try {
    await assignVendor({
      workOrderId: detail.id,
      vendorUserId: parsed.vendorUserId,
      overrideCoi: parsed.overrideCoi,
    });
    revalidatePath("/now");
    revalidatePath("/work");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "assign_failed",
    };
  }
}

/* ------------------ assign technician ------------------ */

const assignTechnicianActionInput = z.object({
  ref: z.string(),
  userId: z.string().uuid(),
});

export async function assignTechnicianAction(
  input: z.input<typeof assignTechnicianActionInput>,
) {
  const parsed = assignTechnicianActionInput.parse(input);
  const detail = await loadEntityDetail(parsed.ref);
  if (!detail || detail.type !== "wo") {
    return { ok: false as const, error: "not_a_work_order" };
  }
  try {
    await assignTechnician({ workOrderId: detail.id, userId: parsed.userId });
    revalidatePath("/now");
    revalidatePath("/work");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "assign_failed",
    };
  }
}

/* ------------------ approve / reject ------------------ */

const decideInput = z.object({
  ref: z.string(),
  to: z.enum(["approved", "rejected"]),
  notes: z.string().max(2000).optional(),
});

export async function decideApprovalAction(
  input: z.input<typeof decideInput>,
) {
  const parsed = decideInput.parse(input);
  const detail = await loadEntityDetail(parsed.ref);
  if (!detail || detail.type !== "approval") {
    return { ok: false as const, error: "not_an_approval" };
  }
  try {
    await decideApproval({ id: detail.id, to: parsed.to, notes: parsed.notes });
    revalidatePath("/now");
    revalidatePath("/money");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "decide_failed",
    };
  }
}

/* ------------------ helpers ------------------ */

function targetTypeFor(
  t: "wo" | "ins" | "prj" | "unit" | "approval",
): "work_order" | "inspection" | "project" | "unit" {
  switch (t) {
    case "wo":
      return "work_order";
    case "ins":
      return "inspection";
    case "prj":
      return "project";
    case "unit":
      return "unit";
    case "approval":
      return "work_order";
  }
}

async function resolveWoId(ref: string): Promise<string | null> {
  const detail = await loadEntityDetail(ref);
  return detail?.id ?? null;
}
