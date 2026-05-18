"use client";

import { EntityDrawer } from "./entity-drawer";
import { cn } from "@/lib/utils";

/**
 * Docked-pane wrapper. Renders the entity drawer as a structural sibling
 * of the main column, not as a modal overlay. When closed, the aside
 * collapses to zero so the main column reclaims the space.
 *
 * Width: 540px on `lg`+ screens (split layout), full-width on smaller
 * desktops where there isn't room for both columns.
 */
export function EntityDrawerDocked({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <aside
      className={cn(
        "shrink-0 border-l border-border bg-background",
        // On small/medium screens: full width (main is hidden via app-shell).
        // On lg+: fixed 540px so the queue stays scannable on the left.
        "w-full lg:w-[540px]",
      )}
    >
      <EntityDrawer />
    </aside>
  );
}
