"use server";

import { revalidatePath } from "next/cache";
import {
  createTemplate,
  setTemplateActive,
  spawnTemplateNow,
  type CreateTemplateInput,
} from "@/lib/server/templates";

export async function createTemplateAction(formData: FormData): Promise<void> {
  const input: CreateTemplateInput = {
    name: String(formData.get("name")),
    description: String(formData.get("description") ?? "") || undefined,
    cron: String(formData.get("cron")),
    timezone: String(formData.get("timezone") ?? "America/New_York") || "America/New_York",
    defaultTitle: String(formData.get("defaultTitle")),
    defaultDescription: String(formData.get("defaultDescription") ?? "") || undefined,
    defaultPriority: (String(formData.get("defaultPriority") ?? "normal") as never) ?? "normal",
    defaultPropertyId: String(formData.get("defaultPropertyId") ?? "") || undefined,
    defaultUnitId: String(formData.get("defaultUnitId") ?? "") || undefined,
    leadTimeHours: Number(formData.get("leadTimeHours") ?? 0) || 0,
  };
  await createTemplate(input);
  revalidatePath("/admin/templates");
}

export async function toggleTemplateActiveAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id"));
  const next = String(formData.get("next")) === "true";
  await setTemplateActive(id, next);
  revalidatePath("/admin/templates");
}

export async function spawnNowAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id"));
  await spawnTemplateNow(id);
  revalidatePath("/admin/templates");
  revalidatePath("/work-orders");
  revalidatePath("/board");
}
