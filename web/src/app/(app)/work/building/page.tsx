import Link from "next/link";
import { loadPropertiesIndex } from "@/lib/server/reporting";
import { Page, PageHeader } from "@/components/ui/page";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

/**
 * Buildings index — the entry to the per-building work surface. Each building
 * links to its own designed work-order page (not a filter on the main list).
 */
export default async function BuildingsIndexPage() {
  const buildings = await loadPropertiesIndex();

  return (
    <Page width="default">
      <PageHeader
        eyebrow="Work orders"
        title="Buildings"
        description="Open work, one building at a time."
      />
      {buildings.length === 0 ? (
        <EmptyState title="No buildings yet." />
      ) : (
        <ul className="divide-y divide-border/50">
          {buildings.map((b) => (
            <li key={b.id}>
              <Link
                href={`/work/building/${b.id}`}
                className="flex items-center gap-2 px-2 py-2.5 text-body hover:bg-muted/40"
              >
                <span className="min-w-0 truncate font-medium text-foreground">{b.name}</span>
                {b.techName && (
                  <span className="shrink-0 text-label text-muted-foreground">· {b.techName}</span>
                )}
                <span className="ml-auto shrink-0 text-label tabular-nums text-muted-foreground">
                  {b.openCount} open
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
