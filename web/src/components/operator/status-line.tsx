"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface StatusSegment {
  /** Short label rendered before the value. */
  label: string;
  /** Numeric or short-string value. */
  value: number | string;
  href: string;
  /** Optional one-line context (e.g. `oldest 14d`). */
  detail?: string | null;
  /** When true, the value renders in the overdue color. */
  alert?: boolean;
}

/**
 * Dense single-line operational status row. Replaces the four-tile pulse
 * grid with a typewriter-style status read-out that lives at the top of /now.
 * Reads like a dispatch terminal header: every segment is a clickable handle
 * into a scoped surface.
 *
 *   23 open · 5 overdue (oldest 14d) · 2 blocked · 4 awaiting · $4.2k pending
 *
 * Wraps to a second line on narrow screens but stays one logical row.
 */
export function StatusLine({ segments }: { segments: StatusSegment[] }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline gap-x-1 gap-y-1 rounded-md",
        "px-2 py-1.5 font-mono text-[11px] tabular-nums",
      )}
      aria-label="Operational status"
    >
      {segments.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && (
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
          )}
          <Link
            href={s.href}
            className="group inline-flex items-baseline gap-1 rounded px-1 py-0.5 transition-colors hover:bg-accent"
          >
            <span
              className={cn(
                "tabular-nums",
                s.alert ? "text-urgency-overdue" : "text-foreground",
              )}
            >
              {s.value}
            </span>
            <span className="text-muted-foreground">{s.label}</span>
            {s.detail && (
              <span className="text-muted-foreground/70">({s.detail})</span>
            )}
          </Link>
        </React.Fragment>
      ))}
    </div>
  );
}
