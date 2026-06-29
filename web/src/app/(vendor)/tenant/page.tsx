import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { loadTenantRequests } from "@/lib/server/tenant-requests";
import { RequestCard } from "@/components/tenant/request-card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

/**
 * Tenant home — the resident's repair requests. Big "Report an issue" CTA up
 * top; requests needing the resident's attention float to the front.
 */
export default async function TenantHome() {
  const session = await readTenantSession();
  if (!session) redirect("/tenant/invalid");

  const requests = await loadTenantRequests(session);
  // Action-needed first, then open, then closed — each newest-first (already
  // sorted by createdAt from the loader).
  const sorted = [...requests].sort((a, b) => {
    const rank = (r: (typeof requests)[number]) =>
      r.needsAction ? 0 : r.isOpen ? 1 : 2;
    return rank(a) - rank(b);
  });

  return (
    <div>
      <Link
        href="/tenant/new"
        className="flex h-14 items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        <Plus className="size-5" />
        Report an issue
      </Link>

      <h2 className="mb-2 mt-6 text-meta font-medium uppercase tracking-wider text-muted-foreground">
        Your requests
      </h2>

      {sorted.length === 0 ? (
        <EmptyState
          title="No requests yet."
          description="Something not working? Tap “Report an issue” and we’ll get on it."
        />
      ) : (
        <ul className="space-y-2.5">
          {sorted.map((r) => (
            <li key={r.id}>
              <RequestCard request={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
