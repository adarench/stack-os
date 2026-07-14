"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PRIMARY_NAV,
  SECONDARY_NAV,
  FOOT_NAV,
  type NavItem,
  type BadgeKey,
} from "./nav-items";
import type { ShellSummary } from "@/lib/server/shell";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function badgeValue(summary: ShellSummary | null, key?: BadgeKey): number {
  if (!summary || !key) return 0;
  switch (key) {
    case "overdue":
      return summary.overdue;
    case "needs":
      return summary.needs;
    case "blocked":
      return summary.blocked;
    case "cois_30d":
      return summary.cois30d;
    case "unread":
      return summary.unread;
  }
}

function badgeAlert(key: BadgeKey | undefined, value: number): boolean {
  if (!key) return false;
  if (value === 0) return false;
  // Overdue and needs lanes always tone red when non-zero.
  return key === "overdue" || key === "needs";
}

function RailLink({
  item,
  pathname,
  summary,
}: {
  item: NavItem;
  pathname: string;
  summary: ShellSummary | null;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const value = badgeValue(summary, item.badgeKey);
  const alert = badgeAlert(item.badgeKey, value);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          className={cn(
            "group relative flex h-8 items-center gap-3 rounded-md px-2 text-sm transition-colors",
            active
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          aria-current={active ? "page" : undefined}
        >
          {active && (
            <span
              aria-hidden
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-urgency-brand"
            />
          )}
          <Icon className="size-4 shrink-0" />
          <span className="truncate">{item.label}</span>
          {value > 0 && (
            <span
              className={cn(
                "ml-auto rounded font-mono text-[10px] tabular-nums px-1 py-0",
                alert
                  ? "bg-urgency-overdue/10 text-urgency-overdue"
                  : "text-muted-foreground",
              )}
            >
              {value}
            </span>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

/** Quiet uppercase group heading that separates the rail's two mental models. */
function RailGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pb-1 text-meta font-medium uppercase tracking-wider text-muted-foreground/60">
      {children}
    </div>
  );
}

/**
 * Left rail — desktop only. 200px wide. Two labeled groups: WORK (the daily
 * work-lenses) and PORTFOLIO (the things you manage), each RailLink carrying an
 * inline count badge from the shell summary. Badges tone red on overdue /
 * pending sign-offs; otherwise quiet gray.
 */
export function LeftRail({ summary }: { summary: ShellSummary | null }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-[200px] shrink-0 flex-col border-r border-border bg-background">
      <nav className="flex-1 space-y-4 p-2">
        <div className="space-y-0.5">
          <RailGroupLabel>Work</RailGroupLabel>
          {PRIMARY_NAV.map((item) => (
            <RailLink
              key={item.href}
              item={item}
              pathname={pathname}
              summary={summary}
            />
          ))}
        </div>
        {SECONDARY_NAV.length > 0 && (
          <div className="space-y-0.5">
            <RailGroupLabel>Portfolio</RailGroupLabel>
            {SECONDARY_NAV.map((item) => (
              <RailLink
                key={item.href}
                item={item}
                pathname={pathname}
                summary={summary}
              />
            ))}
          </div>
        )}
      </nav>
      {FOOT_NAV.length > 0 && (
        <div className="p-2">
          {FOOT_NAV.map((item) => (
            <RailLink
              key={item.href}
              item={item}
              pathname={pathname}
              summary={summary}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
