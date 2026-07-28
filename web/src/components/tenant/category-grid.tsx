"use client";

import {
  Droplets,
  Zap,
  Thermometer,
  WashingMachine,
  KeyRound,
  CircleHelp,
  SprayCan,
  Package,
  ShowerHead,
  CupSoda,
  type LucideIcon,
} from "lucide-react";
import {
  WORK_ORDER_CATEGORIES,
  WORK_ORDER_CATEGORY_LABELS,
  type WorkOrderCategory,
} from "@contracts/work-order-category";
import { cn } from "@/lib/utils";

const ICONS: Record<WorkOrderCategory, LucideIcon> = {
  plumbing: Droplets,
  electrical: Zap,
  hvac: Thermometer,
  appliance: WashingMachine,
  locks_doors: KeyRound,
  cleaning: SprayCan,
  supplies: Package,
  restroom_supplies: ShowerHead,
  beverage: CupSoda,
  general: CircleHelp,
};

/** Tap-grid of issue categories. Big targets; one selection. */
export function CategoryGrid({
  value,
  onChange,
}: {
  value: WorkOrderCategory | null;
  onChange: (c: WorkOrderCategory) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {WORK_ORDER_CATEGORIES.map((c) => {
        const Icon = ICONS[c];
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(c)}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border text-center text-label font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground hover:bg-muted/50",
            )}
          >
            <Icon className="size-6" />
            {WORK_ORDER_CATEGORY_LABELS[c]}
          </button>
        );
      })}
    </div>
  );
}
