import { auth } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import {
  loadWorkList,
  type DueFilter,
  type StatusFilter,
  type WorkType,
} from "@/lib/server/work-list";
import { DEFAULT_BOARD_COLUMNS, loadBoard } from "@/lib/server/board";
import { FilterChipBar } from "@/components/operator/filter-chip-bar";
import { ViewModeToggle } from "@/components/operator/view-mode-toggle";
import { EntityRow } from "@/components/operator/entity-row";
import { EntityDrawer } from "@/components/operator/entity-drawer";
import { TimeSinceTicker } from "@/components/operator/time-since";
import { AutoRefresh } from "@/components/operator/auto-refresh";
import { KanbanBoard } from "@/components/board/kanban-board";

export const dynamic = "force-dynamic";

const TYPES = new Set<WorkType>(["wo", "ins", "prj", "all"]);
const STATUSES = new Set<StatusFilter>([
  "open",
  "blocked",
  "in_progress",
  "done",
  "all",
]);
const DUES = new Set<DueFilter>([
  "overdue",
  "today",
  "week",
  "later",
  "none",
  "all",
]);

function pick<T extends string>(
  v: string | null,
  allowed: Set<T>,
  fallback: T,
): T {
  return v && (allowed as Set<string>).has(v) ? (v as T) : fallback;
}

export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  const sp = await searchParams;
  const view = strOrNull(sp.view) === "board" ? "board" : "list";
  const type = pick(strOrNull(sp.type), TYPES, "wo");
  const status = pick(strOrNull(sp.status), STATUSES, "open");
  const due = pick(strOrNull(sp.due), DUES, "all");
  const q = strOrNull(sp.q) ?? undefined;

  if (view === "board") {
    const board = await loadBoard({ view: "all" });
    return (
      <TimeSinceTicker>
        <AutoRefresh intervalMs={30_000} />
        <div className="mx-auto max-w-[1280px] px-3 md:px-4">
          <div className="flex items-center gap-3 border-b border-border py-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {board.total} cards
            </span>
            <span className="ml-auto">
              <ViewModeToggle />
            </span>
          </div>
          <div className="overflow-x-auto pb-16">
            <KanbanBoard
              initial={board.byStatus}
              columns={DEFAULT_BOARD_COLUMNS}
            />
          </div>
        </div>
        <EntityDrawer />
      </TimeSinceTicker>
    );
  }

  const { rows } = await loadWorkList({
    type,
    status,
    due,
    q: q ?? undefined,
  });

  return (
    <TimeSinceTicker>
      <AutoRefresh intervalMs={30_000} />
      <div className="mx-auto max-w-[1280px] px-3 md:px-4">
        <div className="flex items-center gap-3 py-1.5">
          <span className="font-mono text-[11px] tabular-nums uppercase tracking-wider text-muted-foreground">
            {rows.length} {rows.length === 1 ? "item" : "items"}
          </span>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <FilterChipBar />
          </div>
          <span className="shrink-0">
            <ViewModeToggle />
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="mx-auto mt-12 max-w-sm text-center">
            <p className="text-sm font-medium">No matches in this view.</p>
            <p className="text-xs text-muted-foreground">
              Loosen a filter above, or press{" "}
              <kbd className="rounded border border-border bg-muted px-1 font-mono">
                ⌘K
              </kbd>{" "}
              to jump elsewhere.
            </p>
          </div>
        ) : (
          <div className="space-y-0 pb-16">
            {rows.map((row) => (
              <EntityRow key={`${row.type}-${row.ref}`} row={row} />
            ))}
          </div>
        )}
      </div>

      <EntityDrawer />
    </TimeSinceTicker>
  );
}

function strOrNull(v: string | string[] | undefined): string | null {
  if (v === undefined) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
