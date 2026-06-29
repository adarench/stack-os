import { readTenantSession } from "@/lib/server/tenant-auth";
import { loadTenantHeader } from "@/lib/server/tenant-requests";
import { TenantShell } from "@/components/tenant/tenant-shell";

export const dynamic = "force-dynamic";

/**
 * Tenant mobile chrome. Wraps the authed tenant pages in the phone-width
 * shell + bottom nav. Unauthed routes (e.g. /tenant/invalid) render bare so
 * they don't show app chrome to a signed-out visitor.
 */
export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readTenantSession();
  if (!session) return <>{children}</>;
  const header = await loadTenantHeader(session);
  return <TenantShell header={header}>{children}</TenantShell>;
}
