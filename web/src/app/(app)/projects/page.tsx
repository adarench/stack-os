import Link from "next/link";
import { listProjects } from "@/lib/server/projects";
import {
  PROJECT_STATUSES,
  type ProjectStatus,
} from "@contracts/state-machines/project";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterChip, FilterChipBar } from "@/components/ui/filter-chip";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = PROJECT_STATUSES.includes(params.status as ProjectStatus)
    ? (params.status as ProjectStatus)
    : undefined;
  const rows = await listProjects({ status });

  return (
    <Page width="narrow">
      <PageHeader
        title="Projects"
        actions={
          <Button asChild size="sm">
            <Link href="/projects/new">New</Link>
          </Button>
        }
      />

      <FilterChipBar>
        <FilterChip href="/projects" active={!status}>
          All
        </FilterChip>
        {PROJECT_STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={`/projects?status=${s}`}
            active={status === s}
          >
            {s.replace(/_/g, " ")}
          </FilterChip>
        ))}
      </FilterChipBar>

      {rows.length === 0 ? (
        <EmptyState
          title="No projects yet."
          description="Create one to get started."
        >
          <Button asChild size="sm">
            <Link href="/projects/new">New project</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border/50">
          {rows.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="block px-2 py-2.5 text-body hover:bg-muted/40"
              >
                <div className="flex items-center gap-2">
                  <span className="text-label text-muted-foreground">
                    {p.kind.replace(/_/g, " ")}
                  </span>
                  <Badge tone={toneForStatus(p.status)} className="ml-auto">
                    {p.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="mt-1 text-body font-medium text-foreground">
                  {p.name}
                </div>
                {p.description && (
                  <p className="mt-0.5 line-clamp-2 text-label text-muted-foreground">
                    {p.description}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
