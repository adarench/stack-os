import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, listProjectWorkOrders } from "@/lib/server/projects";
import { listProperties, listUnits } from "@/lib/server/properties";
import { StatusPill } from "@/components/status-pill";
import {
  PROJECT_STATUSES,
  canTransition as canProjectTransition,
  type ProjectStatus,
} from "@contracts/state-machines/project";
import type { WorkOrderStatus } from "@contracts/state-machines/work-order";
import { transitionProjectStatusAction } from "../_actions";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<ProjectStatus, string> = {
  planning: "bg-neutral-100 text-neutral-700",
  active: "bg-amber-100 text-amber-800",
  punch_list: "bg-sky-100 text-sky-800",
  closing: "bg-emerald-100 text-emerald-800",
  closed: "bg-emerald-200 text-emerald-900",
  cancelled: "bg-neutral-200 text-neutral-500 line-through",
};

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
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/projects" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <span className="text-xs text-neutral-500">{project.kind.replace(/_/g, " ")}</span>
        <span className="ml-auto">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${STATUS_PILL[status]}`}
          >
            {status.replace(/_/g, " ")}
          </span>
        </span>
      </header>

      <h1 className="text-lg font-semibold">{project.name}</h1>
      {(property || unit) && (
        <div className="mt-1 text-xs text-neutral-500">
          {property?.name}
          {property && unit ? " · " : ""}
          {unit?.label}
        </div>
      )}
      {project.description && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{project.description}</p>
      )}

      {next.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Move project
          </h2>
          <div className="flex flex-wrap gap-2">
            {next.map((to) => (
              <form key={to} action={transitionProjectStatusAction}>
                <input type="hidden" name="id" value={project.id} />
                <input type="hidden" name="to" value={to} />
                <button
                  type="submit"
                  className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-neutral-700 active:bg-neutral-100"
                >
                  → {to.replace(/_/g, " ")}
                </button>
              </form>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Work orders ({wos.length})
        </h2>
        {wos.length === 0 ? (
          <p className="text-xs text-neutral-500">
            No WOs attached yet. Open a WO and link it to this project from its detail page.
          </p>
        ) : (
          <div className="space-y-3">
            {Array.from(grouped.entries()).map(([s, arr]) => (
              <div key={s}>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {s.replace(/_/g, " ")} ({arr.length})
                </h3>
                <ul className="space-y-1">
                  {arr.map((w) => (
                    <li
                      key={w.id}
                      className="rounded border border-neutral-200 bg-white p-2 text-sm"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-neutral-500">WO-{w.number}</span>
                        <span className="ml-auto">
                          <StatusPill status={w.status as WorkOrderStatus} />
                        </span>
                      </div>
                      <Link
                        href={`/work-orders/${w.id}`}
                        className="mt-1 block text-sm hover:underline"
                      >
                        {w.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
