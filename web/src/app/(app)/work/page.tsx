import Link from "next/link";
import { auth } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import {
  loadWorkList,
  type DueFilter,
  type MineFilter,
  type StatusFilter,
  type WorkRow,
  type WorkType,
} from "@/lib/server/work-list";
import { DEFAULT_BOARD_COLUMNS, loadBoard } from "@/lib/server/board";
import { FilterChipBar } from "@/components/operator/filter-chip-bar";
import { ViewModeToggle } from "@/components/operator/view-mode-toggle";
import { SavedViewTabs, activeViewFor } from "@/components/operator/saved-view-tabs";
import { EntityRow, type TailMode } from "@/components/operator/entity-row";
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
const DUES = new Set<DueFilter>([
  "overdue",
  "today",
  "week",
  "later",
  "none",
  "all",
]);
const MINES = new Set<MineFilter>(["all", "mine", "unassigned"]);

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
  const mine = pick(strOrNull(sp.mine), MINES, "all");
  const q = strOrNull(sp.q) ?? undefined;
  const backlogOpen = strOrNull(sp.backlog) === "open";

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
    due,
    mine,
    q: q ?? undefined,
  });

  // Partition rows into urgency bands. Same flat list visually, but the
  // operator's eye lands on pressure first because we render inline
  // section headers between each band.
  const bands = partitionBands(rows);

  return (
    <TimeSinceTicker>
      <AutoRefresh intervalMs={30_000} />
      <div className="mx-auto max-w-[1280px] px-3 md:px-4">
        <SavedViewTabs active={activeViewFor(sp)} />
        <div className="flex items-center gap-3 py-1.5">
          <span className="font-mono text-[11px] tabular-nums uppercase tracking-wider text-muted-foreground">
            {rows.length} {rows.length === 1 ? "item" : "items"}
          </span>
          <details className="min-w-0 flex-1">
            <summary className="cursor-pointer select-none font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
              Custom filters
            </summary>
            <div className="mt-1.5 flex items-center gap-3 overflow-x-auto">
              <MineToggle current={mine} sp={sp} />
              <FilterChipBar />
            </div>
          </details>
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
            {BAND_ORDER.map((band) => {
              const items = bands[band];
              if (items.length === 0) return null;
              if (band === "backlog" && !backlogOpen) {
                return <BacklogCollapsed key={band} count={items.length} sp={sp} />;
              }
              return (
                <BandSection
                  key={band}
                  band={band}
                  items={items}
                  collapsible={band === "backlog"}
                  sp={sp}
                />
              );
            })}
          </div>
        )}
      </div>
    </TimeSinceTicker>
  );
}

/* -------------------- band partitioning -------------------- */

type Band = "overdue" | "blocked" | "today" | "inflight" | "active" | "backlog";

const BAND_ORDER: Band[] = [
  "overdue",
  "blocked",
  "today",
  "inflight",
  "active",
  "backlog",
];

const BAND_LABEL: Record<Band, string> = {
  overdue: "Overdue",
  blocked: "Blocked",
  today: "Today",
  inflight: "In-flight",
  active: "Active",
  backlog: "Backlog",
};

const BAND_TAIL: Record<Band, TailMode> = {
  overdue: "overdue",
  blocked: "blocked",
  today: "today",
  inflight: "inflight",
  active: "default",
  backlog: "default",
};

function partitionBands(rows: WorkRow[]): Record<Band, WorkRow[]> {
  const out: Record<Band, WorkRow[]> = {
    overdue: [],
    blocked: [],
    today: [],
    inflight: [],
    active: [],
    backlog: [],
  };
  for (const r of rows) {
    out[bandFor(r)].push(r);
  }
  return out;
}

/**
 * Urgency-band assignment. Routine low-priority rows (and `muted`
 * rows that aren't aged) fall into backlog so they don't crowd the
 * triage surface.
 */
function bandFor(r: WorkRow): Band {
  if (r.urgency === "overdue") return "overdue";
  if (r.urgency === "blocked") return "blocked";
  if (r.urgency === "today") return "today";
  if (r.urgency === "inflow") return "inflight";
  // muted / done: split active vs backlog by priority.
  if (r.priority === "low") return "backlog";
  return "active";
}

/* -------------------- band rendering -------------------- */

function BandSection({
  band,
  items,
  collapsible,
  sp,
}: {
  band: Band;
  items: WorkRow[];
  collapsible: boolean;
  sp: Record<string, string | string[] | undefined>;
}) {
  const isPressureBand = band === "overdue" || band === "blocked";
  const titleTone =
    band === "overdue"
      ? "text-urgency-overdue"
      : band === "blocked"
        ? "text-urgency-blocked"
        : "text-muted-foreground";
  const countTone =
    band === "overdue"
      ? "text-urgency-overdue"
      : band === "blocked"
        ? "text-urgency-blocked"
        : "text-muted-foreground";
  return (
    <section
      aria-label={BAND_LABEL[band]}
      className={cn(
        "border-t border-border first:border-t-0",
        band === "overdue" && "border-urgency-overdue/30",
        band === "blocked" && "border-urgency-blocked/30",
      )}
    >
      <header className="flex items-baseline gap-2 px-2 pb-1 pt-3">
        <h2
          className={cn(
            "text-[11px] uppercase tracking-wider",
            isPressureBand ? "font-bold" : "font-semibold",
            titleTone,
          )}
        >
          {BAND_LABEL[band]}
        </h2>
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums",
            countTone,
          )}
        >
          {items.length}
        </span>
        {collapsible && (
          <Link
            href={hrefWith(sp, { backlog: null })}
            scroll={false}
            className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            collapse ▴
          </Link>
        )}
      </header>
      <div className="space-y-0">
        {items.map((row) => (
          <EntityRow
            key={`${row.type}-${row.ref}`}
            row={row}
            tailMode={BAND_TAIL[band]}
          />
        ))}
      </div>
    </section>
  );
}

function BacklogCollapsed({
  count,
  sp,
}: {
  count: number;
  sp: Record<string, string | string[] | undefined>;
}) {
  return (
    <Link
      href={hrefWith(sp, { backlog: "open" })}
      scroll={false}
      className="mt-3 flex items-baseline gap-2 border-t border-border px-2 pt-3 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
    >
      <span className="font-semibold">Backlog</span>
      <span className="font-mono tabular-nums">{count}</span>
      <span className="ml-2 font-mono normal-case tracking-normal">
        click to expand ▾
      </span>
    </Link>
  );
}

/* -------------------- mine toggle -------------------- */

function MineToggle({
  current,
  sp,
}: {
  current: MineFilter;
  sp: Record<string, string | string[] | undefined>;
}) {
  const OPTIONS: { value: MineFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "mine", label: "Mine" },
    { value: "unassigned", label: "Unassigned" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Ownership"
      className="flex shrink-0 items-center gap-0.5"
    >
      {OPTIONS.map((o) => {
        const active = o.value === current;
        return (
          <Link
            key={o.value}
            href={hrefWith(sp, { mine: o.value === "all" ? null : o.value })}
            scroll={false}
            role="radio"
            aria-checked={active}
            className={cn(
              "h-6 rounded px-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors",
              "inline-flex items-center",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

/* -------------------- helpers -------------------- */

function hrefWith(
  sp: Record<string, string | string[] | undefined>,
  patch: Record<string, string | null>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") params.set(k, v);
    else if (Array.isArray(v) && v[0]) params.set(k, v[0]);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) params.delete(k);
    else params.set(k, v);
  }
  const q = params.toString();
  return q ? `/work?${q}` : `/work`;
}

function strOrNull(v: string | string[] | undefined): string | null {
  if (v === undefined) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
