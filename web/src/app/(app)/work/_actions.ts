"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createSavedView,
  deleteSavedView,
  togglePinSavedView,
} from "@/lib/server/saved-views";

const saveInput = z.object({
  name: z.string().trim().min(1).max(80),
  params: z.string().max(500),
  pinned: z.boolean().optional(),
});

export async function saveViewAction(input: z.input<typeof saveInput>) {
  try {
    const parsed = saveInput.parse(input);
    await createSavedView(parsed);
    revalidatePath("/work");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "save_failed" };
  }
}

export async function deleteViewAction(id: string) {
  try {
    await deleteSavedView(z.string().uuid().parse(id));
    revalidatePath("/work");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "delete_failed" };
  }
}

export async function togglePinAction(id: string) {
  try {
    await togglePinSavedView(z.string().uuid().parse(id));
    revalidatePath("/work");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "toggle_failed" };
  }
}
