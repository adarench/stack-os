import Link from "next/link";
import { cn } from "@/lib/utils";

interface PulseStat {
  label: string;
  value: number | string;
  href: string;
  /** When true, value renders in the overdue color. */
  alert?: boolean;
}

/**
 * Strip of four micro-stats above the /now lanes. Each tile is a link to a
 * scoped surface — clicking jumps the operator to the matching filtered view.
 */
export function PulseStrip({ stats }: { stats: PulseStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
      {stats.map((s) => (
        <Link
          key={s.label}
          href={s.href}
          className="group flex flex-col gap-0.5 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-accent"
        >
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {s.label}
          </span>
          <span
            className={cn(
              "font-mono text-xl tabular-nums",
              s.alert ? "text-urgency-overdue" : "text-foreground",
            )}
          >
            {s.value}
          </span>
        </Link>
      ))}
    </div>
  );
}
