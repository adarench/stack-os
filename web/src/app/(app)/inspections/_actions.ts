"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addFinding,
  completeInspection,
  createInspection,
  removeFinding,
  reviewInspection,
  updateFinding,
} from "@/lib/server/inspections";
import { INSPECTION_KINDS } from "@contracts/state-machines/inspection";
import { FINDING_SEVERITIES } from "@contracts/finding-severity";

export async function createInspectionAction(formData: FormData): Promise<void> {
  const propertyId = String(formData.get("propertyId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");
  const ins = await createInspection({
    kind: (formData.get("kind") as never) ?? "ad_hoc",
    propertyId: propertyId || undefined,
    unitId: unitId || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
  });
  revalidatePath("/inspections");
  redirect(`/inspections/${ins.id}`);
}

export async function addFindingAction(formData: FormData): Promise<void> {
  const inspectionId = String(formData.get("inspectionId"));
  const severity = String(formData.get("severity") ?? "observation");
  const pass = String(formData.get("pass") ?? "true") === "true";
  await addFinding({
    inspectionId,
    area: String(formData.get("area") ?? "") || undefined,
    description: String(formData.get("description")),
    severity: (severity as (typeof FINDING_SEVERITIES)[number]) ?? "observation",
    pass,
  });
  revalidatePath(`/inspections/${inspectionId}`);
}

export async function updateFindingAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id"));
  const inspectionId = String(formData.get("inspectionId"));
  const passRaw = formData.get("pass");
  const severityRaw = formData.get("severity");
  await updateFinding({
    id,
    pass: passRaw == null ? undefined : String(passRaw) === "true",
    severity: severityRaw ? ((severityRaw as never) ?? undefined) : undefined,
    description: String(formData.get("description") ?? "") || undefined,
  });
  revalidatePath(`/inspections/${inspectionId}`);
}

export async function removeFindingAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id"));
  const inspectionId = String(formData.get("inspectionId"));
  await removeFinding(id);
  revalidatePath(`/inspections/${inspectionId}`);
}

export async function completeInspectionAction(formData: FormData): Promise<void> {
  const inspectionId = String(formData.get("inspectionId"));
  await completeInspection(inspectionId);
  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath("/inspections");
  revalidatePath("/work-orders");
  revalidatePath("/board");
}

export async function reviewInspectionAction(formData: FormData): Promise<void> {
  const inspectionId = String(formData.get("inspectionId"));
  await reviewInspection(inspectionId);
  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath("/inspections");
}

