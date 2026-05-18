"use client";

import * as React from "react";
import Link from "next/link";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCommandPalette } from "./command-palette";
import { cn } from "@/lib/utils";
import type { ShellSummary } from "@/lib/server/shell";

/**
 * Top bar — 44px sticky. The operational anchor.
 *
 *   [org]   [42 open · 8 overdue (9h) · 4 blocked · 5 awaiting · COIs 3]   [⌘K]  [+]  [avatar]
 *
 * The status line lives here so the operator never loses sight of the
 * operational state, regardless of which surface they're on. Every
 * segment is a clickable jump to a scoped surface.
 *
 * Settings + sign-out live inside the Clerk UserButton dropdown — they
 * no longer occupy a slot in the daily rail.
 */
export function TopBar({ summary }: { summary: ShellSummary | null }) {
  const { setOpen } = useCommandPalette();
  const onOpenCommand = () => setOpen(true);
  return (
    <header className="sticky top-0 z-30 flex h-11 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex shrink-0 items-center">
        <OrganizationSwitcher
          hidePersonal
          appearance={{
            elements: {
              rootBox: "h-7",
              organizationSwitcherTrigger:
                "px-2 py-1 rounded-md hover:bg-accent text-sm",
            },
          }}
          afterSelectOrganizationUrl="/now"
          afterCreateOrganizationUrl="/now"
        />
      </div>

      {summary && (
        <div className="hidden md:flex min-w-0 flex-1 items-center">
          <StatusReadout summary={summary} />
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenCommand}
          className="hidden md:flex h-7 items-center gap-2 rounded-md border border-input bg-background/50 px-2 text-left text-xs text-muted-foreground hover:bg-accent"
          aria-label="Open command palette"
        >
          <Search className="size-3.5" />
          <span>Search</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          onClick={onOpenCommand}
          className="md:hidden inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
          aria-label="Open command palette"
        >
          <Search className="size-4" />
        </button>

        <div className="hidden md:flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Create new"
                onClick={onOpenCommand}
              >
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New…</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center pl-1">
          <UserButton
            appearance={{
              elements: { avatarBox: "h-7 w-7" },
            }}
          />
        </div>
      </div>
    </header>
  );
}

/**
 * The persistent dispatch read-out. Dot-separated, monospace, quietly
 * loud where it counts. Zero-value segments collapse silently.
 */
function StatusReadout({ summary }: { summary: ShellSummary }) {
  const segments: StatusSegment[] = [
    {
      label: "open",
      value: summary.open,
      href: "/work?status=open",
    },
    {
      label: "overdue",
      value: summary.overdue,
      href: "/work?due=overdue",
      detail: summary.oldestOverdueMs
        ? humanizeMs(summary.oldestOverdueMs)
        : null,
      alert: summary.overdue > 0,
    },
    {
      label: "blocked",
      value: summary.blocked,
      href: "/work?status=blocked",
      alert: summary.blocked > 0,
    },
    {
      label: "awaiting",
      value: summary.needs,
      href: "/money?tab=approvals",
      alert: summary.needs > 0,
    },
    {
      label: "COIs ≤30d",
      value: summary.cois30d,
      href: "/compliance?tab=cois&filter=expiring",
      alert: summary.cois30d > 0,
    },
  ];
  const visible = segments.filter((s) => s.value > 0 || s.alert);
  if (visible.length === 0) {
    return (
      <span className="font-mono text-[11px] text-muted-foreground/70">
        all lanes clear
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0 font-mono text-[11px] tabular-nums">
      {visible.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && (
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
          )}
          <Link
            href={s.href}
            className="group inline-flex items-baseline gap-1 rounded px-1 py-0.5 hover:bg-accent"
          >
            <span className={cn(s.alert ? "text-urgency-overdue" : "text-foreground")}>
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

interface StatusSegment {
  label: string;
  value: number;
  href: string;
  detail?: string | null;
  alert?: boolean;
}

function humanizeMs(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}
