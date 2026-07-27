"use server";
import { revalidatePath } from "next/cache";
import {
  techAcknowledge,
  techSetStatus,
  techComplete,
  techAddNote,
  techReplyToRequester,
} from "@/lib/server/technician";

export async function ackAction(formData: FormData) {
  const ref = String(formData.get("ref"));
  await techAcknowledge(ref);
  revalidatePath(`/tech/${ref}`);
}

export async function startAction(formData: FormData) {
  const ref = String(formData.get("ref"));
  await techSetStatus({ ref, to: "in_progress" });
  revalidatePath(`/tech/${ref}`);
}

export async function blockAction(formData: FormData) {
  const ref = String(formData.get("ref"));
  await techSetStatus({ ref, to: "blocked" });
  revalidatePath(`/tech/${ref}`);
}

export async function completeAction(formData: FormData) {
  const ref = String(formData.get("ref"));
  await techComplete(ref);
  revalidatePath(`/tech/${ref}`);
  revalidatePath("/tech");
}

export async function replyAction(formData: FormData) {
  const ref = String(formData.get("ref"));
  const body = String(formData.get("body") ?? "").trim();
  if (body) await techReplyToRequester(ref, body);
  revalidatePath(`/tech/${ref}`);
}

export async function noteAction(formData: FormData) {
  const ref = String(formData.get("ref"));
  const body = String(formData.get("body") ?? "").trim();
  if (body) await techAddNote(ref, body);
  revalidatePath(`/tech/${ref}`);
}
