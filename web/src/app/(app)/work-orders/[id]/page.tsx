import { redirect } from "next/navigation";
import { getWorkOrder } from "@/lib/server/work-orders";

/**
 * Legacy WO deep-link. Work-order detail is the docked drawer on /work, keyed
 * by WO-number. Resolve the uuid to its number and open the drawer directly;
 * fall back to /work if it can't be resolved (unknown id / out of scope). This
 * is also what makes push-notification deep-links (which carry the uuid) land
 * on the actual work order instead of the bare list.
 */
export default async function WorkOrderDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let dest = "/work";
  try {
    const wo = await getWorkOrder(id);
    if (wo) dest = `/work?d=WO-${wo.number}`;
  } catch {
    // Malformed id or out-of-scope — fall back to the list.
  }
  redirect(dest);
}
