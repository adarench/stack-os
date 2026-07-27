import Link from "next/link";
import { redirect } from "next/navigation";
import { readVendorSession } from "@/lib/server/vendor-auth";
import { withVendorScope } from "@/lib/server/db";
import { vendorUsers } from "@db/schema/vendor-users";
import { vendors } from "@db/schema/vendors";
import { workOrders } from "@db/schema/work-orders";
import { assignments } from "@db/schema/assignments";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function VendorHome() {
  const session = await readVendorSession();
  if (!session) redirect("/vendor/invalid");

  const data = await withVendorScope(session, async (tx) => {
    const me = await tx
      .select({
        id: vendorUsers.id,
        name: vendorUsers.name,
        email: vendorUsers.email,
        vendorName: vendors.name,
      })
      .from(vendorUsers)
      .leftJoin(vendors, eq(vendors.id, vendorUsers.vendorId))
      .where(eq(vendorUsers.id, session.vendorUserId))
      .limit(1);

    const myWOs = await tx
      .select({
        id: workOrders.id,
        number: workOrders.number,
        title: workOrders.title,
        status: workOrders.status,
        priority: workOrders.priority,
        dueAt: workOrders.dueAt,
      })
      .from(workOrders)
      .innerJoin(
        assignments,
        and(
          eq(assignments.targetType, "work_order"),
          eq(assignments.targetId, workOrders.id),
          eq(assignments.assigneeType, "vendor_user"),
          eq(assignments.assigneeId, session.vendorUserId),
          isNull(assignments.unassignedAt),
        ),
      )
      .orderBy(desc(workOrders.createdAt))
      .limit(50);

    return { me: me[0] ?? null, workOrders: myWOs };
  });

  return (
    <Page as="main" width="narrow">
      <PageHeader
        title={data.me?.vendorName ?? "Vendor"}
        description={data.me?.name ?? data.me?.email ?? "Signed in"}
      />

      <SectionHeading>Assigned to you</SectionHeading>

      {data.workOrders.length === 0 ? (
        <EmptyState
          title="Nothing assigned right now."
          description="New work orders assigned to you will appear here."
        />
      ) : (
        <ul className="divide-y divide-border/50">
          {data.workOrders.map((w) => (
            <li key={w.id}>
              <Link
                href={`/vendor/WO-${w.number}`}
                className="flex flex-col gap-1 px-2 py-2.5 text-body hover:bg-muted/40"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-meta text-muted-foreground">WO-{w.number}</span>
                  <Badge tone={toneForStatus(w.status)}>
                    {w.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="text-foreground">{w.title}</div>
                {w.dueAt && (
                  <div className="text-meta text-muted-foreground">
                    Due {new Date(w.dueAt).toLocaleDateString()}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
