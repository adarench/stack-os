import { redirect } from "next/navigation";

/**
 * Stage A redirect. /dispatcher folded into /work?view=dispatcher (the
 * pressure-zone cockpit subsumes the dispatcher loop). Removed in the
 * next release.
 */
export default function DispatcherRedirect() {
  redirect("/work?view=dispatcher");
}
