import Link from "next/link";
import { listInspections } from "@/lib/server/inspections";
import {
  INSPECTION_STATUSES,
  type InspectionStatus,
} from "@contracts/state-machines/inspection";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<InspectionStatus, string> = {
  scheduled: "bg-neutral-100 text-neutral-700",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  reviewed: "bg-emerald-200 text-emerald-900",
  cancelled: "bg-neutral-200 text-neutral-500 line-through",
};

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = INSPECTION_STATUSES.includes(params.status as InspectionStatus)
    ? (params.status as InspectionStatus)
    : undefined;
  const rows = await listInspections({ status });

  return (
    <main className="mx-auto max-w-md p-4 pb-24">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Inspections</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/checklists"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700"
          >
            Checklists
          </Link>
          <Link
            href="/inspections/new"
            className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            + New
          </Link>
        </div>
      </header>

      <nav className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-2 text-xs">
        <FilterChip href="/inspections" active={!status}>
          All
        </FilterChip>
        {INSPECTION_STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={`/inspections?status=${s}`}
            active={status === s}
          >
            {s.replace(/_/g, " ")}
          </FilterChip>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-neutral-500">
          No inspections yet.{" "}
          <Link href="/inspections/new" className="underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((i) => (
            <li key={i.id}>
              <Link
                href={`/inspections/${i.id}`}
                className="block rounded border border-neutral-200 bg-white p-3 active:bg-neutral-50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">{i.kind.replace("_", " ")}</span>
                  <span
                    className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
                      STATUS_PILL[i.status as InspectionStatus]
                    }`}
                  >
                    {i.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {i.scheduledFor
                    ? `Scheduled ${new Date(i.scheduledFor).toLocaleString()}`
                    : `Created ${new Date(i.createdAt).toLocaleDateString()}`}
                </div>
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
