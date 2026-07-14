"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCommandPalette } from "./command-palette";
import { useShortcutHint } from "./keyboard-provider";
import { BellLink } from "./bell-link";
import { AccountMenu } from "./account-menu";
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
 * Notifications (bell), the admin/config layer, and sign-out live in the
 * account menu at the right edge; the daily rail stays focused on work.
 */
export function TopBar({ summary }: { summary: ShellSummary | null }) {
  const { setOpen } = useCommandPalette();
  const onOpenCommand = () => setOpen(true);
  const openShortcuts = useShortcutHint();
  return (
    <header className="sticky top-0 z-30 flex h-11 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Brand anchor — single org, so no switcher. */}
      <div className="flex shrink-0 items-center gap-2">
        <span
          aria-hidden
          className="hidden md:inline font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/80"
        >
          STACK · OPS
        </span>
      </div>

      {summary && (
        <div className="hidden md:flex min-w-0 flex-1 items-center border-l border-border pl-3">
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

        <BellLink />

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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={openShortcuts}
                aria-label="Keyboard shortcuts"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md font-mono text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                ?
              </button>
            </TooltipTrigger>
            <TooltipContent>Keyboard shortcuts</TooltipContent>
          </Tooltip>
        </div>

        <div className="hidden md:flex items-center pl-1">
          <AccountMenu />
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
  // Maintenance-only header: open work, what's waiting, what's aging. Money
  // (awaiting sign-offs) and Compliance (COIs) are not part of this operation's
  // daily readout and are removed from the demo header.
  const segments: StatusSegment[] = [
    {
      label: "open",
      value: summary.open,
      href: "/work?status=open",
    },
    {
      label: "waiting",
      value: summary.blocked,
      href: "/work?status=blocked",
      alert: summary.blocked > 0,
    },
    {
      // Points at the Aging lens (open >7d). Note: the count still reflects the
      // legacy due-date overdue metric until loadQueueSummary is reframed to
      // open-age — tracked as a follow-up to the /work Gate-1 reframe.
      label: "aging >7d",
      value: summary.overdue,
      href: "/work?aging=1",
      detail: summary.oldestOverdueMs
        ? humanizeMs(summary.oldestOverdueMs)
        : null,
      alert: summary.overdue > 0,
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
