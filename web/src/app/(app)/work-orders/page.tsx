import { redirect } from "next/navigation";

/**
 * Stage A redirect. /work-orders is the legacy list surface; /work is the
 * unified power-lens that replaces it. Removed in the next release.
 */
export default function WorkOrdersRedirect() {
  redirect("/work");
}
