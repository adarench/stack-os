import { redirect } from "next/navigation";

/**
 * Stage A redirect. /dashboard (stat-tile reflex) is removed; operators live
 * in /now. Removed in the next release.
 */
export default function DashboardRedirect() {
  redirect("/now");
}
