"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./theme-provider";
import { TopBar } from "./top-bar";
import { LeftRail } from "./left-rail";
import { BottomTabBar } from "./bottom-tab-bar";
import { CommandPaletteProvider } from "./command-palette";
import { InstallPrompt } from "./install-prompt";
import { OfflineIndicator } from "./offline-indicator";
import { Toaster } from "@/components/ui/sonner";
import { KeyboardProvider } from "./keyboard-provider";
import { EntityDrawerDocked } from "./entity-drawer-docked";
import { cn } from "@/lib/utils";
import type { ShellSummary } from "@/lib/server/shell";

/**
 * AppShell — the persistent operator frame.
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ TopBar  (status line + search + new + profile)          │
 *   ├──────────┬────────────────────────────┬─────────────────┤
 *   │          │                            │                 │
 *   │ LeftRail │ Main (children)            │ EntityDrawer    │  ← docked
 *   │          │                            │ (when ?d= set)  │
 *   │          │                            │                 │
 *   └──────────┴────────────────────────────┴─────────────────┘
 *   │ BottomTabBar (mobile only)                              │
 *
 * The drawer is a structural sibling of `<main>`, not a modal overlay.
 * When the operator opens an entity, the queue stays visible and
 * scrollable to the left of it. This is the cockpit pattern.
 */
export function AppShell({
  children,
  summary,
}: {
  children: React.ReactNode;
  summary: ShellSummary | null;
}) {
  const sp = useSearchParams();
  const drawerOpen = !!sp.get("d");

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={300}>
        <CommandPaletteProvider>
          <KeyboardProvider>
            <div className="flex h-svh flex-col">
              <TopBar summary={summary} />
              <div className="flex flex-1 overflow-hidden">
                <LeftRail summary={summary} />
                <main
                  className={cn(
                    "flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0",
                    drawerOpen && "md:hidden lg:block lg:max-w-[calc(100%-540px)]",
                  )}
                >
                  {children}
                </main>
                <EntityDrawerDocked open={drawerOpen} />
              </div>
              <BottomTabBar />
            </div>
            <InstallPrompt />
            <OfflineIndicator />
            <Toaster />
          </KeyboardProvider>
        </CommandPaletteProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
