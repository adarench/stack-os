import Link from "next/link";
import { listProjects } from "@/lib/server/projects";
import {
  PROJECT_STATUSES,
  type ProjectStatus,
} from "@contracts/state-machines/project";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<ProjectStatus, string> = {
  planning: "bg-neutral-100 text-neutral-700",
  active: "bg-amber-100 text-amber-800",
  punch_list: "bg-sky-100 text-sky-800",
  closing: "bg-emerald-100 text-emerald-800",
  closed: "bg-emerald-200 text-emerald-900",
  cancelled: "bg-neutral-200 text-neutral-500 line-through",
};

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
    <main className="mx-auto max-w-md p-4 pb-24">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Projects</h1>
        <Link
          href="/projects/new"
          className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
        >
          + New
        </Link>
      </header>

      <nav className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-2 text-xs">
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
      </nav>

      {rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-neutral-500">
          No projects yet.{" "}
          <Link href="/projects/new" className="underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="block rounded border border-neutral-200 bg-white p-3 active:bg-neutral-50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">{p.kind.replace(/_/g, " ")}</span>
                  <span
                    className={`ml-auto inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${STATUS_PILL[p.status as ProjectStatus]}`}
                  >
                    {p.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="mt-1 text-sm font-medium">{p.name}</div>
                {p.description && (
                  <p className="mt-0.5 text-xs text-neutral-600 line-clamp-2">{p.description}</p>
                )}
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
