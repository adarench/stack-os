"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createFollowUp,
  resolveFollowUp,
  snoozeFollowUp,
} from "@/lib/server/follow-ups";

/* ------------------ add a follow-up (manual capture) ------------------ */

const addInput = z.object({
  title: z.string().min(1).max(500),
  nextAction: z.string().max(500).optional(),
  targetType: z.string().optional(),
  targetId: z.string().uuid().optional(),
  assignToMe: z.boolean().optional(),
});

export async function addFollowUpAction(input: z.input<typeof addInput>) {
  const parsed = addInput.parse(input);
  try {
    await createFollowUp({ ...parsed, sourceChannel: "manual" });
    revalidatePath("/now");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "add_failed" };
  }
}

/* ------------------ resolve / snooze ------------------ */

export async function resolveFollowUpAction(id: string) {
  try {
    await resolveFollowUp(z.string().uuid().parse(id));
    revalidatePath("/now");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "resolve_failed" };
  }
}

export async function snoozeFollowUpAction(id: string, days: number) {
  try {
    await snoozeFollowUp(
      z.string().uuid().parse(id),
      z.number().int().min(1).max(30).parse(days),
    );
    revalidatePath("/now");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "snooze_failed" };
  }
}
