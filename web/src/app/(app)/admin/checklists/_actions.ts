"use server";

import { revalidatePath } from "next/cache";
import {
  createChecklistTemplate,
  addChecklistTemplateItem,
  removeChecklistTemplateItem,
} from "@/lib/server/checklists";

export async function createChecklistTemplateAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (name) await createChecklistTemplate(name);
  revalidatePath("/admin/checklists");
}

export async function addChecklistTemplateItemAction(formData: FormData): Promise<void> {
  await addChecklistTemplateItem({
    templateId: String(formData.get("templateId")),
    title: String(formData.get("title")),
  });
  revalidatePath("/admin/checklists");
}

export async function removeChecklistTemplateItemAction(formData: FormData): Promise<void> {
  await removeChecklistTemplateItem(String(formData.get("id")));
  revalidatePath("/admin/checklists");
}
