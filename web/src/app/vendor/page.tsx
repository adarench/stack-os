import { redirect } from "next/navigation";
import { readVendorSession } from "@/lib/server/vendor-auth";
import { withVendorScope } from "@/lib/server/db";
import { vendorUsers } from "@db/schema/vendor-users";
import { vendors } from "@db/schema/vendors";
import { workOrders } from "@db/schema/work-orders";
import { assignments } from "@db/schema/assignments";
import { and, desc, eq, isNull } from "drizzle-orm";

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
    <main className="mx-auto max-w-md p-4 pb-24">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">{data.me?.vendorName ?? "Vendor"}</h1>
        <p className="text-sm text-neutral-500">
          {data.me?.name ?? data.me?.email ?? "Signed in"}
        </p>
      </header>

      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
        Assigned to you
      </h2>

      {data.workOrders.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing assigned right now.</p>
      ) : (
        <ul className="space-y-2">
          {data.workOrders.map((w) => (
            <li
              key={w.id}
              className="rounded border border-neutral-200 bg-white p-3 active:bg-neutral-50"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-neutral-500">WO-{w.number}</span>
                <span className="text-xs font-medium uppercase">{w.status}</span>
              </div>
              <div className="mt-1 text-sm">{w.title}</div>
              {w.dueAt && (
                <div className="mt-1 text-xs text-neutral-500">
                  Due {new Date(w.dueAt).toLocaleDateString()}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
