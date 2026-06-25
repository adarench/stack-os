import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPropertyDetail, loadUnitWorkOrders } from "@/lib/server/reporting";
import { workOrderStatusLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Property detail — units on the left, the selected unit's full dated work
 * history on the right (every work order, incl. closed), with the current
 * tenant. This is the "what did we do for tenant X" report.
 */
export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ unit?: string }>;
}) {
  const { id } = await params;
  const { unit } = await searchParams;
  const detail = await loadPropertyDetail(id);
  if (!detail) notFound();

  const selectedUnitId = unit ?? detail.units[0]?.id ?? null;
  const log = selectedUnitId ? await loadUnitWorkOrders(selectedUnitId) : null;
  const address = [detail.property.addressLine1, detail.property.city, detail.property.state]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="mx-auto max-w-4xl p-4 pb-24">
      <header className="mb-4 flex items-baseline gap-3">
        <Link href="/properties" className="text-sm text-muted-foreground">
          ← Properties
        </Link>
        <h1 className="text-lg font-semibold">{detail.property.name}</h1>
        {address && <span className="text-xs text-muted-foreground">{address}</span>}
      </header>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        {/* Units */}
        <nav className="space-y-1">
          <h2 className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Units
          </h2>
          {detail.units.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">No units.</p>
          ) : (
            detail.units.map((u) => (
              <Link
                key={u.id}
                href={`/properties/${id}?unit=${u.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  u.id === selectedUnitId
                    ? "bg-foreground text-background"
                    : "hover:bg-muted",
                )}
              >
                <span className="font-medium">{u.label}</span>
                <span
                  className={cn(
                    "truncate text-xs",
                    u.id === selectedUnitId ? "text-background/70" : "text-muted-foreground",
                  )}
                >
                  {u.tenantName ?? "vacant"}
                </span>
                {u.openCount > 0 && (
                  <span
                    className={cn(
                      "ml-auto shrink-0 rounded px-1 text-[10px] tabular-nums",
                      u.id === selectedUnitId
                        ? "bg-background/20"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {u.openCount}
                  </span>
                )}
              </Link>
            ))
          )}
        </nav>

        {/* Selected unit's work history */}
        <section>
          {!log ? (
            <p className="text-sm text-muted-foreground">Select a unit.</p>
          ) : (
            <>
              <div className="mb-3 flex items-baseline gap-2">
                <h2 className="text-base font-semibold">
                  {log.unit.unitLabel}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {log.tenant?.name ?? "vacant"}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {log.workOrders.length} work order
                  {log.workOrders.length === 1 ? "" : "s"}
                </span>
              </div>
              {log.workOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No work orders recorded for this unit yet.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {log.workOrders.map((w) => (
                    <li key={w.id} className="flex items-baseline gap-3 px-3 py-2 text-sm">
                      <span className="w-[64px] shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {w.ref}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{w.title}</span>
                      <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {workOrderStatusLabel(w.status)}
                      </span>
                      <span className="w-[72px] shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                        {new Date(w.completedAt ?? w.createdAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
