import Link from "next/link";
import { listWorkOrders } from "@/lib/server/work-orders";
import { listProperties, listUnits } from "@/lib/server/properties";
import { StatusPill } from "@/components/status-pill";
import { WoSearch } from "@/components/wo-search";
import { FilterSelect } from "@/components/board/filter-select";
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from "@contracts/state-machines/work-order";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
  property?: string;
  priority?: string;
}

const PRIORITY_DOT: Record<WorkOrderPriority, string> = {
  low: "bg-neutral-300",
  normal: "bg-sky-400",
  high: "bg-amber-500",
  urgent: "bg-rose-600",
};

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = WORK_ORDER_STATUSES.includes(params.status as WorkOrderStatus)
    ? (params.status as WorkOrderStatus)
    : undefined;
  const propertyId = params.property || undefined;
  const priority = WORK_ORDER_PRIORITIES.includes(params.priority as WorkOrderPriority)
    ? (params.priority as WorkOrderPriority)
    : undefined;

  const [rows, properties, units] = await Promise.all([
    listWorkOrders({ q: q || undefined, status, propertyId, priority, limit: 200 }),
    listProperties(),
    listUnits(),
  ]);

  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const unitById = new Map(units.map((u) => [u.id, u]));

  const hasFilters = Boolean(q || status || propertyId || priority);

  return (
    <main className="mx-auto max-w-md p-4 pb-24">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Work orders</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-neutral-600"
          >
            Dashboard
          </Link>
          <Link
            href="/dispatcher"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-neutral-600"
          >
            Dispatch
          </Link>
          <Link
            href="/board"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-neutral-600"
          >
            Board
          </Link>
          <Link
            href="/admin/templates"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-neutral-600"
          >
            Templates
          </Link>
          <Link
            href="/inspections"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-neutral-600"
          >
            Inspections
          </Link>
          <Link
            href="/projects"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-neutral-600"
          >
            Projects
          </Link>
          <Link
            href="/work-orders/new"
            className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            + New
          </Link>
        </div>
      </header>

      <div className="mb-3">
        <WoSearch defaultValue={q} preserve={preserveExcept(params, "q")} />
      </div>

      <nav className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-2 text-xs">
        <FilterChip href={chipHref(params, { status: undefined })} active={!status}>
          All
        </FilterChip>
        {WORK_ORDER_STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={chipHref(params, { status: s })}
            active={status === s}
          >
            {s.replace(/_/g, " ")}
          </FilterChip>
        ))}
      </nav>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <FilterSelect
          name="property"
          value={propertyId ?? ""}
          options={[
            { value: "", label: "All properties" },
            ...properties.map((p) => ({ value: p.id, label: p.name })),
          ]}
          preserve={preserveExcept(params, "property")}
          action="/work-orders"
        />
        <FilterSelect
          name="priority"
          value={priority ?? ""}
          options={[
            { value: "", label: "Any priority" },
            ...WORK_ORDER_PRIORITIES.map((p) => ({ value: p, label: p })),
          ]}
          preserve={preserveExcept(params, "priority")}
          action="/work-orders"
        />
        {hasFilters && (
          <Link
            href="/work-orders"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 uppercase tracking-wide text-neutral-500"
          >
            Clear
          </Link>
        )}
      </div>

      <p className="mb-2 text-xs text-neutral-500">
        {rows.length} {rows.length === 1 ? "result" : "results"}
        {q && ` for "${q}"`}
      </p>

      {rows.length === 0 ? (
        <EmptyState hasFilters={hasFilters} q={q} />
      ) : (
        <ul className="space-y-2">
          {rows.map((w) => {
            const prop = w.propertyId ? propertyById.get(w.propertyId) : null;
            const unit = w.unitId ? unitById.get(w.unitId) : null;
            return (
              <li key={w.id}>
                <Link
                  href={`/work-orders/${w.id}`}
                  className="block rounded border border-neutral-200 bg-white p-3 active:bg-neutral-50"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${PRIORITY_DOT[w.priority as WorkOrderPriority]}`}
                      aria-label={`priority ${w.priority}`}
                    />
                    <span className="text-xs text-neutral-500">WO-{w.number}</span>
                    <span className="ml-auto">
                      <StatusPill status={w.status as WorkOrderStatus} />
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-medium leading-snug">{w.title}</div>
                  {(prop || unit) && (
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {prop?.name}
                      {prop && unit ? " · " : ""}
                      {unit?.label}
                    </div>
                  )}
                  {w.dueAt && (
                    <div className="mt-1 text-xs text-neutral-500">
                      Due {new Date(w.dueAt).toLocaleDateString()}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
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

function EmptyState({ hasFilters, q }: { hasFilters: boolean; q: string }) {
  if (!hasFilters) {
    return (
      <p className="mt-8 text-center text-sm text-neutral-500">
        No work orders yet.{" "}
        <Link href="/work-orders/new" className="underline">
          Create one
        </Link>
        .
      </p>
    );
  }
  return (
    <p className="mt-8 text-center text-sm text-neutral-500">
      No work orders match{q ? ` "${q}"` : " these filters"}.{" "}
      <Link href="/work-orders" className="underline">
        Clear filters
      </Link>
      .
    </p>
  );
}

function chipHref(base: SearchParams, patch: Partial<SearchParams>): string {
  const merged = { ...base, ...patch };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v && String(v).length > 0) sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `/work-orders?${qs}` : "/work-orders";
}

function preserveExcept(base: SearchParams, dropKey: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(base)) {
    if (k === dropKey) continue;
    if (v === undefined || v === null) continue;
    const s = String(v);
    if (s.length === 0) continue;
    out.push([k, s]);
  }
  return out;
}
