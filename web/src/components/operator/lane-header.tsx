import { cn } from "@/lib/utils";

type Tone = "red" | "amber" | "muted";

/**
 * Lane header — name + colored count + optional aside. Coloring rules:
 *  - red:   overdue ≥ 1 or needs-you ≥ 5
 *  - amber: blocked ≥ 1 or today ≥ 5
 *  - muted: everything else
 *
 * The lane controls its own visibility — when count is 0, lane renders as
 * a quiet header line (or the parent may hide it entirely).
 */
export function LaneHeader({
  title,
  count,
  tone = "muted",
  emphasized = false,
  aside,
}: {
  title: string;
  count?: number;
  tone?: Tone;
  /** When true, the lane TITLE inherits the tone color (not just the count)
   *  and gets bolder typography. Used on the overdue / blocked lanes so
   *  the section heading itself screams. */
  emphasized?: boolean;
  aside?: React.ReactNode;
}) {
  const toneClass: Record<Tone, string> = {
    red: "text-urgency-overdue",
    amber: "text-urgency-blocked",
    muted: "text-muted-foreground",
  };
  return (
    <div className="flex items-center gap-2 px-2 pb-1 pt-3">
      <h2
        className={cn(
          "text-[11px] uppercase tracking-wider",
          emphasized ? "font-bold" : "font-semibold",
          emphasized ? toneClass[tone] : "text-muted-foreground",
        )}
      >
        {title}
      </h2>
      {typeof count === "number" && (
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums",
            toneClass[tone],
          )}
        >
          {count}
        </span>
      )}
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  );
}

export function laneTone(
  lane: "needs" | "overdue" | "blocked" | "today" | "inflight" | "changed",
  count: number,
): Tone {
  if (count === 0) return "muted";
  if (lane === "overdue") return "red";
  if (lane === "needs" && count >= 5) return "red";
  if (lane === "blocked") return "amber";
  if (lane === "today" && count >= 5) return "amber";
  return "muted";
}
