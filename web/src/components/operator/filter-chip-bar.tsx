"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface ChipDef {
  value: string;
  label: string;
}

interface ChipGroup {
  param: string;
  /** Default value when param is absent. */
  defaultValue: string;
  chips: ChipDef[];
}

const GROUPS: ChipGroup[] = [
  {
    param: "type",
    defaultValue: "wo",
    chips: [
      { value: "all", label: "All" },
      { value: "wo", label: "Work" },
      { value: "ins", label: "Inspections" },
      { value: "prj", label: "Projects" },
    ],
  },
  {
    param: "status",
    defaultValue: "open",
    chips: [
      { value: "all", label: "All" },
      { value: "open", label: "Open" },
      { value: "blocked", label: "Blocked" },
      { value: "in_progress", label: "In progress" },
      { value: "done", label: "Done" },
    ],
  },
  {
    param: "due",
    defaultValue: "all",
    chips: [
      { value: "all", label: "Any" },
      { value: "overdue", label: "Overdue" },
      { value: "today", label: "Today" },
      { value: "week", label: "This week" },
      { value: "later", label: "Later" },
      { value: "none", label: "No due" },
    ],
  },
];

/**
 * Horizontal chip bar — three filter groups. Reads/writes URL state via
 * shallow `router.replace`. Saved-view persistence (Step 7 follow-up) keys
 * off the URL.
 */
export function FilterChipBar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = React.useCallback(
    (param: string, value: string, defaultValue: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value === defaultValue) {
        sp.delete(param);
      } else {
        sp.set(param, value);
      }
      const q = sp.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div
      className="flex flex-wrap gap-x-2 gap-y-1 pb-1 pt-0.5 text-[11px]"
      aria-label="Filters"
    >
      {GROUPS.map((group, gi) => {
        const current = searchParams.get(group.param) ?? group.defaultValue;
        return (
          <div
            key={group.param}
            className={cn(
              "flex shrink-0 items-center gap-0.5",
              gi > 0 && "border-l border-border/60 pl-2",
            )}
            role="radiogroup"
            aria-label={group.param}
          >
            {group.chips.map((chip) => {
              const active = chip.value === current;
              const visible = active || current === group.defaultValue;
              return (
                <button
                  key={chip.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() =>
                    setParam(group.param, chip.value, group.defaultValue)
                  }
                  className={cn(
                    "h-6 rounded px-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : visible
                        ? "text-muted-foreground hover:bg-accent hover:text-foreground"
                        : "text-muted-foreground/60 hover:bg-accent hover:text-foreground",
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
