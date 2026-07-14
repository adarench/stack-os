import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getProject, listProjectWorkOrders } from "@/lib/server/projects";
import { listProperties, listUnits } from "@/lib/server/properties";
import { StatusPill } from "@/components/status-pill";
import { Page, PageHeader } from "@/components/ui/page";
import { SectionHeading } from "@/components/ui/panel";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PROJECT_STATUSES,
  canTransition as canProjectTransition,
  type ProjectStatus,
} from "@contracts/state-machines/project";
import type { WorkOrderStatus } from "@contracts/state-machines/work-order";
import { transitionProjectStatusAction } from "../_actions";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [wos, properties, units] = await Promise.all([
    listProjectWorkOrders(id),
    listProperties(),
    listUnits(),
  ]);

  const property = project.propertyId
    ? properties.find((p) => p.id === project.propertyId)
    : null;
  const unit = project.unitId ? units.find((u) => u.id === project.unitId) : null;
  const status = project.status as ProjectStatus;
  const next = PROJECT_STATUSES.filter((s) => canProjectTransition(status, s));

  // Group WOs by status for a mini kanban-style summary.
  const grouped = new Map<WorkOrderStatus, typeof wos>();
  for (const w of wos) {
    const arr = grouped.get(w.status as WorkOrderStatus) ?? [];
    arr.push(w);
    grouped.set(w.status as WorkOrderStatus, arr);
  }

  return (
    <Page width="default">
      <PageHeader
        title={project.name}
        backHref="/projects"
        eyebrow={project.kind.replace(/_/g, " ")}
        description={
          property || unit ? (
            <>
              {property?.name}
              {property && unit ? " · " : ""}
              {unit?.label}
            </>
          ) : undefined
        }
        actions={
          <Badge tone={toneForStatus(status)} size="md">
            {status.replace(/_/g, " ")}
          </Badge>
        }
      />

      {project.description && (
        <p className="whitespace-pre-wrap text-body text-foreground">
          {project.description}
        </p>
      )}

      {(project.budgetCents != null || project.targetCompletion) && (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-label text-muted-foreground">
          {project.budgetCents != null && (
            <>
              <dt className="font-medium text-muted-foreground">Budget</dt>
              <dd>
                {(Number(project.budgetCents) / 100).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </dd>
            </>
          )}
          {project.targetCompletion && (
            <>
              <dt className="font-medium text-muted-foreground">Target</dt>
              <dd>{new Date(project.targetCompletion).toLocaleDateString()}</dd>
            </>
          )}
        </dl>
      )}

      {next.length > 0 && (
        <section className="mt-5">
          <SectionHeading>Move project</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {next.map((to) => (
              <form key={to} action={transitionProjectStatusAction}>
                <input type="hidden" name="id" value={project.id} />
                <input type="hidden" name="to" value={to} />
                <Button type="submit" variant="outline" size="sm">
                  <ChevronRight className="size-3.5" />
                  {to.replace(/_/g, " ")}
                </Button>
              </form>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <SectionHeading>Work orders ({wos.length})</SectionHeading>
        {wos.length === 0 ? (
          <p className="text-label text-muted-foreground">
            No WOs attached yet. Open a WO and link it to this project from its detail page.
          </p>
        ) : (
          <div className="space-y-3">
            {Array.from(grouped.entries()).map(([s, arr]) => (
              <div key={s}>
                <h3 className="mb-1 text-meta font-medium uppercase tracking-wider text-muted-foreground">
                  {s.replace(/_/g, " ")} ({arr.length})
                </h3>
                <ul className="divide-y divide-border/50">
                  {arr.map((w) => (
                    <li
                      key={w.id}
                      className="flex items-baseline gap-2 px-2 py-2.5 text-body hover:bg-muted/40"
                    >
                      <span className="text-label text-muted-foreground">
                        WO-{w.number}
                      </span>
                      <Link
                        href={`/work?d=WO-${w.number}`}
                        scroll={false}
                        className="min-w-0 truncate hover:underline"
                      >
                        {w.title}
                      </Link>
                      <span className="ml-auto">
                        <StatusPill status={w.status as WorkOrderStatus} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
