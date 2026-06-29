import * as React from "react";
import { BottomNav } from "./bottom-nav";
import type { TenantHeader } from "@/lib/server/tenant-requests";

/**
 * Tenant mobile shell — a phone-width column with a quiet top bar (where the
 * resident lives) and the bottom nav. No operator chrome. On desktop it
 * renders centered at phone width so it always reads as a mobile app.
 */
export function TenantShell({
  header,
  children,
}: {
  header: TenantHeader | null;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col border-x border-border bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <p className="truncate text-title font-semibold tracking-tight text-foreground">
          {header?.propertyName ?? "Stack · Home"}
        </p>
        <p className="truncate text-label text-muted-foreground">
          {header?.unitLabel
            ? `Unit ${header.unitLabel}`
            : (header?.name ?? header?.email ?? "Signed in")}
        </p>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}
