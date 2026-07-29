import { auth } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { NEW_SHELL } from "@/lib/feature-flags";
import { readTenantSession } from "@/lib/server/tenant-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId, orgId, role } = await auth();
  if (!userId) {
    // The PWA manifest start_url is "/", shared by both surfaces. A resident who
    // installed from /tenant (Android honors start_url) must land in their portal,
    // not the operator sign-in. Operator session takes precedence above.
    if (await readTenantSession()) redirect("/tenant");
    redirect("/sign-in");
  }
  if (!orgId) redirect("/select-org");
  // Technicians land on their mobile field surface, not the operator cockpit (M4).
  if (role === "technician") redirect("/tech");
  redirect(NEW_SHELL ? "/my" : "/work");
}
