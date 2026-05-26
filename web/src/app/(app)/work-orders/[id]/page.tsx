import { redirect } from "next/navigation";

/**
 * Stage A redirect. WO detail is the drawer on /work, not its own page.
 * Deep-link by uuid lands on /work; users can locate the WO via ⌘K.
 * Removed in the next release.
 */
export default async function WorkOrderDetailRedirect() {
  redirect("/work");
}
