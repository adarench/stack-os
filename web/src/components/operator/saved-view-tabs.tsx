import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Built-in lenses for /work — the operator-model surface from the customer
 * call. The lens IS the view: you slice by what needs attention, not by a
 * status/board taxonomy. Each lens foregrounds one of the fields they
 * actually named: owner, seen, tenant update, waiting, age.
 *
 *   All             — every open work order
 *   Mine            — assigned to me
 *   Needs attention — open + not yet seen by the assigned tech
 *   Tenant waiting  — open + tenant not updated
 *   Waiting         — parked on a vendor / part / tenant
 *   Aging >7d       — open over seven days (submission age, not a due date)
 *   Moves           — unit turns
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
    slug: "attention",
    label: "Needs attention",
    params: { type: "wo", attention: "1" },
  },
  {
    slug: "tenant",
    label: "Tenant waiting",
    params: { type: "wo", tenant: "not_updated" },
  },
  { slug: "waiting", label: "Waiting", params: { type: "wo", status: "blocked" } },
  { slug: "aging", label: "Aging >7d", params: { type: "wo", aging: "1" } },
  // Moves (unit turns internally) are a first-class workflow — their own list.
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
      aria-label="Lenses"
      className="-mx-3 flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2 md:-mx-4 md:px-4"
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
              "shrink-0 rounded-full px-3 py-1 text-[13px] transition-colors",
              isActive
                ? "bg-foreground font-medium text-background"
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
