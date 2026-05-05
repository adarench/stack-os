import Link from "next/link";
import { listWorkOrders } from "@/lib/server/work-orders";
import { StatusPill } from "@/components/status-pill";
import { WORK_ORDER_STATUSES, type WorkOrderStatus } from "@contracts/state-machines/work-order";

export const dynamic = "force-dynamic";

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const filterStatus = WORK_ORDER_STATUSES.includes(params.status as WorkOrderStatus)
    ? (params.status as WorkOrderStatus)
    : undefined;
  const rows = await listWorkOrders({ status: filterStatus, limit: 100 });

  return (
    <main className="mx-auto max-w-md p-4 pb-24">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Work orders</h1>
        <Link
          href="/work-orders/new"
          className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
        >
          + New
        </Link>
      </header>

      <nav className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-2 text-xs">
        <FilterChip href="/work-orders" active={!filterStatus}>
          All
        </FilterChip>
        {WORK_ORDER_STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={`/work-orders?status=${s}`}
            active={filterStatus === s}
          >
            {s.replace(/_/g, " ")}
          </FilterChip>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-neutral-500">
          No work orders yet.{" "}
          <Link href="/work-orders/new" className="underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((w) => (
            <li key={w.id}>
              <Link
                href={`/work-orders/${w.id}`}
                className="block rounded border border-neutral-200 bg-white p-3 active:bg-neutral-50"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-neutral-500">WO-{w.number}</span>
                  <StatusPill status={w.status as WorkOrderStatus} />
                </div>
                <div className="mt-1 text-sm font-medium">{w.title}</div>
                {w.dueAt && (
                  <div className="mt-1 text-xs text-neutral-500">
                    Due {new Date(w.dueAt).toLocaleDateString()}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full border px-3 py-1 uppercase tracking-wide ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 bg-white text-neutral-600"
      }`}
    >
      {children}
    </Link>
  );
}
