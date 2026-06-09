import { redirect } from "next/navigation";

/**
 * Stage A redirect. /dashboard (stat-tile reflex) is removed; the team lives
 * in /my (My Work). Removed in the next release.
 */
export default function DashboardRedirect() {
  redirect("/my");
}
