import Link from "next/link";
import {
  isDispatcherTab,
  loadDispatcher,
  type DispatcherTab,
} from "@/lib/server/dispatcher";
import { listProperties, listUnits } from "@/lib/server/properties";
import { listVendors, listVendorUsersForVendor } from "@/lib/server/vendors";
import { DispatcherRow } from "@/components/dispatcher-row";
import type {
  WorkOrderPriority,
  WorkOrderStatus,
} from "@contracts/state-machines/work-order";

export const dynamic = "force-dynamic";

interface SearchParams {
  tab?: string;
  property?: string;
}

export default async function DispatcherPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab: DispatcherTab = isDispatcherTab(params.tab) ? params.tab : "all";
  const propertyId = params.property || undefined;

  const [data, properties, units, vendors] = await Promise.all([
    loadDispatcher({ tab, propertyId }),
    listProperties(),
    listUnits(),
    listVendors(),
  ]);

  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const unitById = new Map(units.map((u) => [u.id, u]));

  const vendorUserOptions = (
    await Promise.all(
      vendors.map(async (v) => {
        const users = await listVendorUsersForVendor(v.id);
        return users.map((u) => ({
          id: u.id,
          label: `${v.name} — ${u.name ?? u.email}`,
        }));
      }),
    )
  ).flat();

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Dispatcher</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/work-orders"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-neutral-600"
          >
            List
          </Link>
          <Link
            href="/board"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-neutral-600"
          >
            Board
          </Link>
          <Link
            href="/work-orders/new"
            className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            + New
          </Link>
        </div>
      </header>

      <nav className="mb-3 flex gap-2 text-xs">
        <TabChip tab="all" current={tab} count={data.counts.all} params={params} />
        <TabChip tab="new" current={tab} count={data.counts.new} params={params} />
        <TabChip tab="triaged" current={tab} count={data.counts.triaged} params={params} />
        <TabChip tab="blocked" current={tab} count={data.counts.blocked} params={params} />
      </nav>

      {data.rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-neutral-500">
          {tab === "all"
            ? "Nothing needs dispatching right now."
            : `No ${tab} work orders.`}
        </p>
      ) : (
        <ul className="space-y-2">
          {data.rows.map((w) => {
            const prop = w.propertyId ? propertyById.get(w.propertyId) : null;
            const unit = w.unitId ? unitById.get(w.unitId) : null;
            return (
              <DispatcherRow
                key={w.id}
                wo={{
                  id: w.id,
                  number: w.number,
                  title: w.title,
                  status: w.status as WorkOrderStatus,
                  priority: w.priority as WorkOrderPriority,
                  createdAt: w.createdAt,
                }}
                propertyName={prop?.name ?? null}
                unitLabel={unit?.label ?? null}
                vendorUserOptions={vendorUserOptions}
              />
            );
          })}
        </ul>
      )}
    </main>
  );
}

function TabChip({
  tab,
  current,
  count,
  params,
}: {
  tab: DispatcherTab;
  current: DispatcherTab;
  count: number;
  params: SearchParams;
}) {
  const active = tab === current;
  const sp = new URLSearchParams();
  if (tab !== "all") sp.set("tab", tab);
  if (params.property) sp.set("property", params.property);
  const qs = sp.toString();
  const href = qs ? `/dispatcher?${qs}` : "/dispatcher";
  const label = tab === "all" ? "All" : tab;
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 uppercase tracking-wide ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 bg-white text-neutral-600"
      }`}
    >
      {label}
      <span className={`ml-1 text-[10px] ${active ? "text-neutral-200" : "text-neutral-400"}`}>
        {count}
      </span>
    </Link>
  );
}
