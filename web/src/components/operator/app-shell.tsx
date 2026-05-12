"use client";

import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./theme-provider";
import { TopBar } from "./top-bar";
import { LeftRail } from "./left-rail";
import { BottomTabBar } from "./bottom-tab-bar";
import { CommandPaletteProvider } from "./command-palette";
import { InstallPrompt } from "./install-prompt";
import { OfflineIndicator } from "./offline-indicator";
import { Toaster } from "@/components/ui/sonner";

/**
 * AppShell — flag-gated operator chrome.
 *
 * Layout:
 *
 *   ┌────────────────────────────────────────────┐
 *   │ TopBar                                     │
 *   ├──────────┬─────────────────────────────────┤
 *   │ LeftRail │ Main (children)                 │
 *   │          │                                 │
 *   └──────────┴─────────────────────────────────┘
 *   │ BottomTabBar (mobile only)                 │
 *
 * Wraps children in providers needed by the new shell. Routes inside the
 * shell continue to render whatever they currently render — the shell only
 * adds chrome around them.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <CommandPaletteProvider>
          <div className="flex min-h-svh flex-col">
            <TopBar />
            <div className="flex flex-1">
              <LeftRail />
              <main className="flex-1 overflow-x-hidden pb-16 md:pb-0">
                {children}
              </main>
            </div>
            <BottomTabBar />
          </div>
          <InstallPrompt />
          <OfflineIndicator />
          <Toaster />
        </CommandPaletteProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
