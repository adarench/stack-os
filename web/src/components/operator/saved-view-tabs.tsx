import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Built-in saved views for /work. Per docs/design/p9_cockpit_strategy.md
 * the /work surface is a power-lens: the dispatcher slices the corpus by
 * saved view, not by free-form filter sprawl. Phase 1 ships built-ins
 * with URL-encoded filter spec; Phase 2 adds user-saved persistent views.
 *
 * Order matches the operator's most-likely scans, top to bottom:
 *   All           — landing tab
 *   Mine          — "what's on my plate"
 *   Mine, overdue — "what's on my plate that's late"
 *   Unassigned    — dispatcher reach-for
 *   Backlog       — everything quiet, intentional drill-down
 */
export interface SavedView {
  slug: string;
  label: string;
  params: Record<string, string>;
}

export const BUILTIN_VIEWS: SavedView[] = [
  { slug: "all", label: "All", params: { type: "wo", status: "open" } },
  { slug: "mine", label: "Mine", params: { type: "wo", mine: "mine" } },
  {
    slug: "mine-overdue",
    label: "Mine, overdue",
    params: { type: "wo", mine: "mine", due: "overdue" },
  },
  {
    slug: "unassigned",
    label: "Unassigned",
    params: { type: "wo", mine: "unassigned" },
  },
  {
    slug: "backlog",
    label: "Backlog",
    params: { type: "wo", status: "open", backlog: "open" },
  },
  // Moves (unit turns internally) are a first-class workflow — scan them as
  // their own list, ranked by move-in risk (urgency derives from child state).
  { slug: "turns", label: "Moves", params: { type: "prj", status: "open" } },
];

/**
 * Match the current URL params against each built-in view; the active view
 * is the most-specific match (longest param-set that matches). Returns
 * `null` if no view matches — e.g. when the operator has applied custom
 * filter chips that don't align with any built-in.
 */
export function activeViewFor(
  params: Record<string, string | string[] | undefined>,
): string | null {
  let best: { slug: string; score: number } | null = null;
  for (const view of BUILTIN_VIEWS) {
    let matches = 0;
    let mismatch = false;
    for (const [k, v] of Object.entries(view.params)) {
      if (params[k] === v) matches += 1;
      else if (params[k] !== undefined && params[k] !== v) {
        mismatch = true;
        break;
      }
    }
    if (mismatch) continue;
    if (!best || matches > best.score) best = { slug: view.slug, score: matches };
  }
  return best?.slug ?? null;
}

export function SavedViewTabs({ active }: { active: string | null }) {
  return (
    <nav
      aria-label="Saved views"
      className="-mx-3 flex gap-1 overflow-x-auto border-b border-border px-3 py-1.5 md:-mx-4 md:px-4"
    >
      {BUILTIN_VIEWS.map((view) => {
        const isActive = active === view.slug;
        const href = `/work?${new URLSearchParams(view.params).toString()}`;
        return (
          <Link
            key={view.slug}
            href={href}
            scroll={false}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors",
              isActive
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
