"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Relative-time chip — `-3d`, `+2h`, `now`. Monospace, right-aligned, sub-15px.
 * Negative when `at` is in the past, positive when in the future. Updates
 * every 60s via a single shared ticker context (one timer for the whole tree).
 */

const TickContext = React.createContext<number>(Date.now());

export function TimeSinceTicker({ children }: { children: React.ReactNode }) {
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return <TickContext.Provider value={now}>{children}</TickContext.Provider>;
}

export function TimeSince({
  at,
  direction = "auto",
  className,
}: {
  at: string | Date;
  direction?: "past" | "future" | "auto";
  className?: string;
}) {
  const now = React.useContext(TickContext);
  const target = typeof at === "string" ? new Date(at).getTime() : at.getTime();
  const deltaMs = target - now;
  const past = direction === "past" || (direction === "auto" && deltaMs <= 0);
  const abs = Math.abs(deltaMs);
  const label = formatRelative(abs, past);

  return (
    <span
      className={cn(
        "shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground",
        className,
      )}
      // Title gives the absolute timestamp on hover for precision.
      title={new Date(target).toLocaleString()}
    >
      {label}
    </span>
  );
}

function formatRelative(absMs: number, past: boolean): string {
  const sign = past ? "-" : "+";
  const m = Math.round(absMs / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${sign}${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${sign}${h}h`;
  const d = Math.round(h / 24);
  if (d < 14) return `${sign}${d}d`;
  const w = Math.round(d / 7);
  if (w < 8) return `${sign}${w}w`;
  const mo = Math.round(d / 30);
  return `${sign}${mo}mo`;
}
