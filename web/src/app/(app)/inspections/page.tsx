import Link from "next/link";
import { listInspections } from "@/lib/server/inspections";
import {
  loadInspectionBoard,
  DEFAULT_INSPECTION_COLUMNS,
} from "@/lib/server/inspection-board";
import {
  INSPECTION_STATUSES,
  type InspectionStatus,
} from "@contracts/state-machines/inspection";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { FilterChip, FilterChipBar } from "@/components/ui/filter-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { InspectionBoard } from "@/components/board/inspection-board";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  const params = await searchParams;
  const view = params.view === "board" ? "board" : "list";

  const headerActions = (
    <>
      <ViewTabs view={view} />
      <Button asChild variant="outline" size="sm">
        <Link href="/admin/checklists">Checklists</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/inspections/new">New</Link>
      </Button>
    </>
  );

  if (view === "board") {
    const board = await loadInspectionBoard();
    return (
      <Page width="full">
        <PageHeader title="Inspections" actions={headerActions} />
        {board.total === 0 ? (
          <EmptyState title="No active inspections.">
            <Button asChild size="sm">
              <Link href="/inspections/new">Create one</Link>
            </Button>
          </EmptyState>
        ) : (
          <InspectionBoard initial={board.byStatus} columns={DEFAULT_INSPECTION_COLUMNS} />
        )}
      </Page>
    );
  }

  const status = INSPECTION_STATUSES.includes(params.status as InspectionStatus)
    ? (params.status as InspectionStatus)
    : undefined;
  const rows = await listInspections({ status });

  return (
    <Page width="narrow">
      <PageHeader title="Inspections" actions={headerActions} />

      <FilterChipBar>
        <FilterChip href="/inspections" active={!status}>
          All
        </FilterChip>
        {INSPECTION_STATUSES.map((s) => (
          <FilterChip key={s} href={`/inspections?status=${s}`} active={status === s}>
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
                  <Badge tone={toneForStatus(i.status)} className="ml-auto">
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

function ViewTabs({ view }: { view: "list" | "board" }) {
  const base =
    "inline-flex h-7 items-center rounded px-2 text-[11px] font-medium uppercase tracking-wide transition-colors";
  const active = "bg-foreground text-background";
  const idle = "text-muted-foreground hover:text-foreground";
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5">
      <Link href="/inspections" className={cn(base, view === "list" ? active : idle)}>
        List
      </Link>
      <Link href="/inspections?view=board" className={cn(base, view === "board" ? active : idle)}>
        Board
      </Link>
    </div>
  );
}
