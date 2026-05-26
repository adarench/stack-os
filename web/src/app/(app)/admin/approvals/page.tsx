import { redirect } from "next/navigation";

/**
 * Stage A redirect. /admin/approvals was a read-only legacy queue; the live
 * approval cockpit lives at /money?tab=approvals. Removed in the next release.
 */
export default function AdminApprovalsRedirect() {
  redirect("/money?tab=approvals");
}
