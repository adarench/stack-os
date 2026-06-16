import { auth } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import {
  loadWorkList,
  type MineFilter,
  type StatusFilter,
  type WorkRow,
  type WorkType,
} from "@/lib/server/work-list";
import { DEFAULT_BOARD_COLUMNS, loadBoard } from "@/lib/server/board";
import { ViewModeToggle } from "@/components/operator/view-mode-toggle";
import { SavedViewTabs, activeViewFor } from "@/components/operator/saved-view-tabs";
import { EntityRow } from "@/components/operator/entity-row";
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
const MINES = new Set<MineFilter>(["all", "mine"]);

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
  const mine = pick(strOrNull(sp.mine), MINES, "all");
  const q = strOrNull(sp.q) ?? undefined;
  // Operator-model lenses.
  const attention = strOrNull(sp.attention) === "1";
  const tenant = strOrNull(sp.tenant) === "not_updated" ? ("not_updated" as const) : undefined;
  const aging = strOrNull(sp.aging) === "1";

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
      </TimeSinceTicker>
    );
  }

  const { rows } = await loadWorkList({
    type,
    status,
    mine,
    q: q ?? undefined,
    attention,
    tenant,
    aging,
  });

  // Operator scan order: longest-waiting on top. Completed/closed sink to the
  // bottom; within the rest, oldest submission first. No urgency bands — the
  // lens is the slice, and the row carries the call's fields.
  const sorted = [...rows].sort((a, b) => {
    const ao = a.isOpen === false ? 1 : 0;
    const bo = b.isOpen === false ? 1 : 0;
    if (ao !== bo) return ao - bo;
    return (a.openedAt ?? a.lastActionAt).localeCompare(b.openedAt ?? b.lastActionAt);
  });

  return (
    <TimeSinceTicker>
      <AutoRefresh intervalMs={30_000} />
      <div className="mx-auto max-w-[1280px] px-3 md:px-4">
        <SavedViewTabs active={activeViewFor(sp)} />
        <div className="flex items-center gap-3 py-1.5">
          <span className="font-mono text-[11px] tabular-nums uppercase tracking-wider text-muted-foreground">
            {rows.length} {rows.length === 1 ? "item" : "items"}
          </span>
          <span className="ml-auto shrink-0">
            <ViewModeToggle />
          </span>
        </div>

        {sorted.length === 0 ? (
          <div className="mx-auto mt-12 max-w-sm text-center">
            <p className="text-sm font-medium">Nothing in this lens.</p>
            <p className="text-xs text-muted-foreground">
              Switch lenses above, or press{" "}
              <kbd className="rounded border border-border bg-muted px-1 font-mono">
                ⌘K
              </kbd>{" "}
              to jump elsewhere.
            </p>
          </div>
        ) : (
          <div className="space-y-0 pb-16">
            {sorted.map((row: WorkRow) => (
              <EntityRow key={`${row.type}-${row.ref}`} row={row} />
            ))}
          </div>
        )}
      </div>
    </TimeSinceTicker>
  );
}

function strOrNull(v: string | string[] | undefined): string | null {
  if (v === undefined) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
