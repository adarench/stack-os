"use server";

import { revalidatePath } from "next/cache";
import {
  createTemplate,
  setTemplateActive,
  spawnTemplateNow,
  type CreateTemplateInput,
} from "@/lib/server/templates";

/**
 * Cadence presets — property managers pick "Weekly · Mondays" instead of
 * authoring cron. "custom" falls through to the raw cron field for power use.
 */
const CADENCE_CRON: Record<string, string> = {
  weekly_mon: "0 9 * * 1",
  weekly_fri: "0 9 * * 5",
  monthly_first: "0 9 1 * *",
  quarterly: "0 9 1 1,4,7,10 *",
  annual: "0 9 1 1 *",
};

export async function createTemplateAction(formData: FormData): Promise<void> {
  const cadence = String(formData.get("cadence") ?? "custom");
  const cron = CADENCE_CRON[cadence] ?? String(formData.get("cron") ?? "").trim();
  if (!cron) throw new Error("Pick a cadence or provide a cron expression.");
  const input: CreateTemplateInput = {
    name: String(formData.get("name")),
    description: String(formData.get("description") ?? "") || undefined,
    cron,
    timezone: String(formData.get("timezone") ?? "America/Denver") || "America/Denver",
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
  revalidatePath("/work");
  revalidatePath("/now");
}
