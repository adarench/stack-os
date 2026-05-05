import Link from "next/link";
import {
  ARCHIVED_BOARD_COLUMNS,
  DEFAULT_BOARD_COLUMNS,
  isBoardPriority,
  loadBoard,
} from "@/lib/server/board";
import { listProperties } from "@/lib/server/properties";
import { KanbanBoard } from "@/components/board/kanban-board";
import { FilterSelect } from "@/components/board/filter-select";
import { WORK_ORDER_PRIORITIES } from "@contracts/state-machines/work-order";

export const dynamic = "force-dynamic";

interface SearchParams {
  view?: string;
  property?: string;
  priority?: string;
  archived?: string;
}

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const view = params.view === "dispatcher" || params.view === "mine" ? params.view : "all";
  const propertyId = params.property || undefined;
  const priority = isBoardPriority(params.priority) ? params.priority : undefined;
  const includeArchived = params.archived === "1";

  const [board, properties] = await Promise.all([
    loadBoard({ view, propertyId, priority, includeArchived }),
    listProperties(),
  ]);

  const columns = includeArchived
    ? [...DEFAULT_BOARD_COLUMNS, ...ARCHIVED_BOARD_COLUMNS]
    : DEFAULT_BOARD_COLUMNS;

  return (
    <main className="mx-auto max-w-screen-2xl p-4 pb-24">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Board</h1>
        <span className="text-xs text-neutral-500">{board.total} cards</span>
        <nav className="ml-auto flex items-center gap-2 text-xs">
          <Link
            href="/work-orders"
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 uppercase tracking-wide text-neutral-600"
          >
            List
          </Link>
          <Link
            href="/work-orders/new"
            className="rounded-full bg-neutral-900 px-3 py-1 font-medium text-white"
          >
            + New
          </Link>
        </nav>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <ViewChip current={view} value="all" label="All" base={params} />
        <ViewChip current={view} value="dispatcher" label="Dispatcher" base={params} />
        <ViewChip current={view} value="mine" label="Created by me" base={params} />
        <span className="mx-2 text-neutral-300">|</span>
        <FilterSelect
          name="property"
          value={propertyId ?? ""}
          options={[
            { value: "", label: "All properties" },
            ...properties.map((p) => ({ value: p.id, label: p.name })),
          ]}
          preserve={preserveExcept(params, "property")}
        />
        <FilterSelect
          name="priority"
          value={priority ?? ""}
          options={[
            { value: "", label: "Any priority" },
            ...WORK_ORDER_PRIORITIES.map((p) => ({ value: p, label: p })),
          ]}
          preserve={preserveExcept(params, "priority")}
        />
        <span className="mx-2 text-neutral-300">|</span>
        <ArchivedToggle includeArchived={includeArchived} base={params} />
      </div>

      <KanbanBoard initial={board.byStatus} columns={columns} />
    </main>
  );
}

function buildHref(base: SearchParams, patch: Partial<SearchParams>): string {
  const merged = { ...base, ...patch };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v && String(v).length > 0) sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `/board?${qs}` : "/board";
}

function preserveExcept(base: SearchParams, dropKey: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(base)) {
    if (k === dropKey) continue;
    if (v === undefined || v === null) continue;
    const s = String(v);
    if (s.length === 0) continue;
    out.push([k, s]);
  }
  return out;
}

function ViewChip({
  current,
  value,
  label,
  base,
}: {
  current: string;
  value: string;
  label: string;
  base: SearchParams;
}) {
  const active = current === value;
  const next = value === "all" ? { view: undefined } : { view: value };
  return (
    <Link
      href={buildHref(base, next)}
      className={`rounded-full border px-3 py-1 uppercase tracking-wide ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 bg-white text-neutral-600"
      }`}
    >
      {label}
    </Link>
  );
}

function ArchivedToggle({
  includeArchived,
  base,
}: {
  includeArchived: boolean;
  base: SearchParams;
}) {
  return (
    <Link
      href={buildHref(base, { archived: includeArchived ? undefined : "1" })}
      className={`rounded-full border px-3 py-1 uppercase tracking-wide ${
        includeArchived
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 bg-white text-neutral-600"
      }`}
    >
      {includeArchived ? "Hide closed" : "Show closed"}
    </Link>
  );
}
