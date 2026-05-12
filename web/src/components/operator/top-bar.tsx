"use client";

import * as React from "react";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCommandPalette } from "./command-palette";
import { BellLink } from "./bell-link";

/**
 * Top bar — 44px fixed. Left: org switcher + ⌘K search-trigger.
 * Right: + New, bell, profile.
 *
 * Search trigger opens the global CommandPalette. The same dialog also
 * fronts the `+ New` action (jumps straight to Create commands).
 */
export function TopBar() {
  const { setOpen } = useCommandPalette();
  const onOpenCommand = () => setOpen(true);
  return (
    <header className="sticky top-0 z-30 flex h-11 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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

      <button
        type="button"
        onClick={onOpenCommand}
        className="hidden md:flex h-7 max-w-md flex-1 items-center gap-2 rounded-md border border-input bg-background/50 px-2 text-left text-xs text-muted-foreground hover:bg-accent"
        aria-label="Open command palette"
      >
        <Search className="size-3.5" />
        <span className="flex-1 truncate">Search or jump to…</span>
        <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <button
        type="button"
        onClick={onOpenCommand}
        className="ml-auto md:hidden inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
        aria-label="Open command palette"
      >
        <Search className="size-4" />
      </button>

      <div className="hidden md:flex ml-auto items-center gap-1">
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

        <BellLink />
      </div>

      <div className="flex items-center pl-1">
        <UserButton
          appearance={{
            elements: { avatarBox: "h-7 w-7" },
          }}
        />
      </div>
    </header>
  );
}
