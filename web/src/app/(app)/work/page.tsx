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
import { WorkOrderRow } from "@/components/operator/work-order-row";
import { TimeSinceTicker } from "@/components/operator/time-since";
import { AutoRefresh } from "@/components/operator/auto-refresh";
import { KanbanBoard } from "@/components/board/kanban-board";
import { cn } from "@/lib/utils";

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

  // Within a group, the longest-waiting sits on top (oldest submission first).
  const byAge = (a: WorkRow, b: WorkRow) =>
    (a.openedAt ?? a.lastActionAt).localeCompare(b.openedAt ?? b.lastActionAt);

  // Work orders are grouped by the operator's escalating question — "have they
  // looked? have they told the tenant?" Moves/inspections stay a flat list.
  const isWoView = type === "wo";
  const groups = isWoView
    ? ATTENTION_GROUPS.map((g) => ({
        ...g,
        items: rows.filter((r) => attentionBucket(r) === g.key).sort(byAge),
      })).filter((g) => g.items.length > 0)
    : [];
  const flat = [...rows].sort((a, b) => {
    const ao = a.isOpen === false ? 1 : 0;
    const bo = b.isOpen === false ? 1 : 0;
    if (ao !== bo) return ao - bo;
    return byAge(a, b);
  });

  return (
    <TimeSinceTicker>
      <AutoRefresh intervalMs={30_000} />
      <div className="mx-auto max-w-[1280px] px-3 md:px-4">
        <SavedViewTabs active={activeViewFor(sp)} />
        <div className="flex items-center gap-3 py-1.5">
          <span className="text-[12px] text-muted-foreground">
            {rows.length} {rows.length === 1 ? "work order" : "work orders"}
          </span>
          <span className="ml-auto shrink-0">
            <ViewModeToggle />
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="mx-auto mt-12 max-w-sm text-center">
            <p className="text-sm font-medium">Nothing here right now.</p>
            <p className="text-xs text-muted-foreground">
              Try another lens above, or press{" "}
              <kbd className="rounded border border-border bg-muted px-1">⌘K</kbd> to
              jump elsewhere.
            </p>
          </div>
        ) : isWoView ? (
          <div className="pb-16">
            {groups.map((g) => (
              <section key={g.key} aria-label={g.label} className="mt-4 first:mt-1">
                <header className="flex items-baseline gap-2 px-2 pb-1">
                  <h2
                    className={cn(
                      "text-[12px] font-semibold tracking-tight",
                      g.tone,
                    )}
                  >
                    {g.label}
                  </h2>
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    {g.items.length}
                  </span>
                </header>
                <div>
                  {g.items.map((row) => (
                    <WorkOrderRow key={row.ref} row={row} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-0 pb-16">
            {flat.map((row: WorkRow) => (
              <EntityRow key={`${row.type}-${row.ref}`} row={row} />
            ))}
          </div>
        )}
      </div>
    </TimeSinceTicker>
  );
}

/**
 * Attention buckets — the operator's escalating concern, derived from existing
 * fields (no backend change): not seen → seen-but-tenant-uninformed → in hand →
 * done. This is the spine of the operator console.
 */
const ATTENTION_GROUPS = [
  { key: "unseen", label: "Not seen", tone: "text-urgency-overdue" },
  { key: "tenant", label: "Tenant waiting", tone: "text-urgency-blocked" },
  { key: "inhand", label: "Active", tone: "text-muted-foreground" },
  { key: "done", label: "Done", tone: "text-muted-foreground" },
] as const;

function attentionBucket(r: WorkRow): (typeof ATTENTION_GROUPS)[number]["key"] {
  if (r.isOpen === false) return "done";
  if (!r.acknowledgedAt) return "unseen";
  if (!r.tenantUpdatedAt) return "tenant";
  return "inhand";
}

function strOrNull(v: string | string[] | undefined): string | null {
  if (v === undefined) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
