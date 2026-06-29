import { redirect } from "next/navigation";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

/**
 * Submit-a-request screen. Placeholder for Phase 1 (the shell + nav need a
 * live destination); the full category → photos → describe → submit flow lands
 * in Phase 2 once the tenant write path + migration are in.
 */
export default async function NewTenantRequestPage() {
  const session = await readTenantSession();
  if (!session) redirect("/tenant/invalid");

  return (
    <EmptyState
      eyebrow="Report an issue"
      title="Almost ready."
      description="Submitting a repair request from here is coming next. For anything urgent, contact your property manager."
    />
  );
}
