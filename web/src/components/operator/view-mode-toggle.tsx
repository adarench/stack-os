"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Mode = "list" | "board";

const MODES: Array<{ value: Mode; label: string; Icon: typeof List }> = [
  { value: "list", label: "List", Icon: List },
  { value: "board", label: "Board", Icon: LayoutGrid },
];

/**
 * Segmented control for /work view mode. Board mode forces `type=wo` because
 * the kanban is work-order-only. Calendar view lands later — once
 * inspections + projects participate.
 */
export function ViewModeToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = (searchParams.get("view") as Mode) ?? "list";

  const set = (next: Mode) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (next === "list") {
      sp.delete("view");
    } else {
      sp.set("view", next);
      sp.set("type", "wo");
    }
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  return (
    <div
      role="radiogroup"
      aria-label="View mode"
      className="inline-flex items-center rounded-md border border-border bg-card p-0.5"
    >
      {MODES.map(({ value, label, Icon }) => {
        const active = value === mode;
        return (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set(value)}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium uppercase tracking-wide transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden md:inline">{label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
