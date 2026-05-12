import { cn } from "@/lib/utils";

export type Urgency =
  | "overdue"
  | "blocked"
  | "today"
  | "inflow"
  | "done"
  | "muted";

const COLORS: Record<Urgency, string> = {
  overdue: "bg-urgency-overdue",
  blocked: "bg-urgency-blocked",
  today: "bg-urgency-today",
  inflow: "bg-urgency-inflow",
  done: "bg-urgency-done",
  muted: "bg-urgency-muted",
};

/**
 * 8px leading dot. Color carries status meaning in dense list contexts.
 * Overdue gets a subtle pulse to draw attention without animation noise.
 */
export function UrgencyDot({
  urgency,
  className,
  pulse,
}: {
  urgency: Urgency;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        COLORS[urgency],
        pulse && urgency === "overdue" && "animate-pulse",
        className,
      )}
    />
  );
}
