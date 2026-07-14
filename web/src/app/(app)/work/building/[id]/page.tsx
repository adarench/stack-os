import Link from "next/link";
import { notFound } from "next/navigation";
import { loadWorkList } from "@/lib/server/work-list";
import { loadPropertyDetail } from "@/lib/server/reporting";
import { groupByAttention } from "@/lib/attention-buckets";
import { WorkOrderRow } from "@/components/operator/work-order-row";
import { TimeSinceTicker } from "@/components/operator/time-since";
import { AutoRefresh } from "@/components/operator/auto-refresh";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Per-building work surface — the "actual design, not just a filter" answer.
 * One building's open work orders, grouped by the same attention spine as
 * /work, with a building header + counts. Reuses the operator WorkOrderRow so
 * building/unit and the issue lead read exactly as they do on the main list.
 */
export default async function BuildingWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, { rows }] = await Promise.all([
    loadPropertyDetail(id),
    loadWorkList({ type: "wo", status: "open", propertyId: id }),
  ]);
  if (!detail) notFound();

  const groups = groupByAttention(rows);
  const openCount = rows.filter((r) => r.isOpen !== false).length;
  const agingCount = rows.filter((r) => r.aged).length;
  const address = [
    detail.property.addressLine1,
    detail.property.city,
    detail.property.state,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <TimeSinceTicker>
      <AutoRefresh intervalMs={30_000} />
      <div className="mx-auto max-w-[1280px] px-3 md:px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-10">
        <PageHeader
          eyebrow="Building"
          title={detail.property.name}
          description={address || undefined}
          backHref="/work/building"
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href={`/properties/${id}`}>History</Link>
            </Button>
          }
        />
        <div className="flex items-center gap-4 border-b border-border py-2 text-label text-muted-foreground">
          <span>
            <span className="font-medium tabular-nums text-foreground">{openCount}</span> open
          </span>
          <span>
            <span className="font-medium tabular-nums text-foreground">{agingCount}</span> aging
          </span>
          <span>
            <span className="font-medium tabular-nums text-foreground">
              {detail.units.length}
            </span>{" "}
            units
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="mx-auto mt-12 max-w-sm text-center">
            <p className="text-sm font-medium">No open work orders in this building.</p>
            <p className="text-xs text-muted-foreground">Nothing needs attention right now.</p>
          </div>
        ) : (
          <div className="pb-16">
            {groups.map((g) => (
              <section key={g.key} aria-label={g.label} className="mt-4 first:mt-1">
                <header className="flex items-center gap-2 px-4 pb-1.5">
                  {g.dot && (
                    <span aria-hidden className={cn("size-1.5 rounded-full", g.dot)} />
                  )}
                  <h2
                    className={cn(
                      "text-label font-medium uppercase tracking-wider",
                      g.tone,
                    )}
                  >
                    {g.label}
                  </h2>
                  <span className="text-label tabular-nums text-muted-foreground/50">
                    {g.items.length}
                  </span>
                </header>
                <div>
                  {g.items.map((row) => (
                    <WorkOrderRow key={row.ref} row={row} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </TimeSinceTicker>
  );
}
