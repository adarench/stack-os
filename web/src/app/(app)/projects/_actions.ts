"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  attachWorkOrderToProject,
  createProject,
  updateProjectStatus,
} from "@/lib/server/projects";
import type { ProjectStatus } from "@contracts/state-machines/project";

export async function createProjectAction(formData: FormData): Promise<void> {
  const propertyId = String(formData.get("propertyId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");
  const budgetRaw = String(formData.get("budgetCents") ?? "");
  const budgetCents = budgetRaw ? Number(budgetRaw) : undefined;
  const p = await createProject({
    name: String(formData.get("name")),
    description: String(formData.get("description") ?? "") || undefined,
    kind: (formData.get("kind") as never) ?? "general",
    propertyId: propertyId || undefined,
    unitId: unitId || undefined,
    budgetCents,
  });
  revalidatePath("/projects");
  redirect(`/projects/${p.id}`);
}

export async function transitionProjectStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id"));
  const to = String(formData.get("to")) as ProjectStatus;
  await updateProjectStatus(id, to);
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}

export async function attachWorkOrderAction(formData: FormData): Promise<void> {
  const workOrderId = String(formData.get("workOrderId"));
  const projectId = String(formData.get("projectId") ?? "") || null;
  await attachWorkOrderToProject({ workOrderId, projectId });
  if (projectId) revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/work-orders/${workOrderId}`);
}
