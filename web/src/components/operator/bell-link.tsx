"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const POLL_MS = 60_000;

/**
 * Top-bar bell. Links to /inbox; shows an unread count badge on the icon.
 * Polls `/api/me/notifications?summary=1` on mount, on focus, and every 60s.
 *
 * (No popover preview in v1 — the click target jumps straight to /inbox.
 * Hover popover with recent notifications lands when notifications get a
 * real read-state column.)
 */
export function BellLink() {
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const fetchSummary = async () => {
      try {
        const r = await fetch("/api/me/notifications?summary=1", {
          cache: "no-store",
        });
        if (!r.ok) return;
        const data = (await r.json()) as { unread: number };
        if (!cancelled) setCount(data.unread);
      } catch {
        // swallow — keep last known count
      }
    };

    void fetchSummary();
    const id = setInterval(fetchSummary, POLL_MS);
    const onFocus = () => void fetchSummary();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const showBadge = count != null && count > 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/inbox"
          aria-label="Notifications"
          className="relative inline-flex size-7 items-center justify-center rounded-md text-foreground hover:bg-accent"
        >
          <Bell className="size-4" />
          {showBadge && (
            <span
              className={cn(
                "absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-mono tabular-nums leading-none text-white",
                "bg-urgency-overdue",
              )}
            >
              {count! > 99 ? "99+" : count}
            </span>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent>Notifications</TooltipContent>
    </Tooltip>
  );
}
