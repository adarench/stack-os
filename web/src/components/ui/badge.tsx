import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The one status chip. Extracted from the canonical operator recipe
 * (work-order-row.tsx): a low (~12%) urgency-token tint with matching token
 * text, h-5, rounded (never rounded-full), font-semibold. Every status pill
 * in the app routes through this — no hand-rolled palette maps, no solid
 * fills, no text-white. Color is rationed to the urgency tokens the shell
 * already speaks, so a chip reads the same on every screen.
 *
 * Tones intentionally exclude raw yellow-as-text (urgency-today) — that token
 * lives on dots/bars where contrast isn't a problem; `scheduled`-type states
 * map to `inflow` for legibility.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        overdue: "bg-urgency-overdue/12 text-urgency-overdue",
        blocked: "bg-urgency-blocked/12 text-urgency-blocked",
        inflow: "bg-urgency-inflow/12 text-urgency-inflow",
        done: "bg-urgency-done/12 text-urgency-done",
        brand: "bg-urgency-brand/12 text-urgency-brand",
        muted: "bg-muted text-muted-foreground",
        outline: "border border-border text-muted-foreground",
      },
      size: {
        sm: "h-5 px-1.5 text-meta",
        md: "h-6 px-2 text-label",
      },
    },
    defaultVariants: { tone: "muted", size: "sm" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size, className }))} {...props} />;
}

/**
 * Map an arbitrary entity status (work order, inspection, project, compliance,
 * finding severity, …) to a badge tone. Centralizes the rainbow that legacy
 * screens used to reinvent. Pass an explicit `tone` to <Badge> to override.
 */
export function toneForStatus(status: string | null | undefined): BadgeTone {
  const s = (status ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (
    /(overdue|critical|expired|expiring|urgent|failed|fail|rejected|past_due|breach)/.test(s)
  )
    return "overdue";
  if (/(blocked|waiting|tenant_waiting|actionable|in_progress|on_hold|pending)/.test(s))
    return "blocked";
  if (/(scheduled|triaged|assigned|new|open|intake|inflow|observation|info|draft|sent)/.test(s))
    return "inflow";
  if (/(resolved|verified|completed|reviewed|done|paid|approved|passed|pass|active|current|covered)/.test(s))
    return "done";
  return "muted";
}
