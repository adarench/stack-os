import Link from "next/link";
import { listInspections } from "@/lib/server/inspections";
import {
  INSPECTION_STATUSES,
  type InspectionStatus,
} from "@contracts/state-machines/inspection";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { FilterChip, FilterChipBar } from "@/components/ui/filter-chip";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

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
    <Page width="narrow">
      <PageHeader
        title="Inspections"
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/checklists">Checklists</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/inspections/new">New</Link>
            </Button>
          </>
        }
      />

      <FilterChipBar>
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
      </FilterChipBar>

      {rows.length === 0 ? (
        <EmptyState title="No inspections yet.">
          <Button asChild size="sm">
            <Link href="/inspections/new">Create one</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border/50">
          {rows.map((i) => (
            <li key={i.id}>
              <Link
                href={`/inspections/${i.id}`}
                className="flex flex-col gap-1 px-2 py-2.5 text-body hover:bg-muted/40"
              >
                <div className="flex items-center gap-2">
                  <span className="text-label text-muted-foreground">
                    {i.kind.replace("_", " ")}
                  </span>
                  <Badge
                    tone={toneForStatus(i.status)}
                    className="ml-auto"
                  >
                    {i.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="text-label text-muted-foreground">
                  {i.scheduledFor
                    ? `Scheduled ${new Date(i.scheduledFor).toLocaleString()}`
                    : `Created ${new Date(i.createdAt).toLocaleDateString()}`}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
