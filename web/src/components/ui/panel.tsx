import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A restrained grouped surface for forms and discrete sections. Hairline
 * border + bg-card, rounded-md, no shadow — elevation is reserved for the few
 * true overlays (drawer, popovers, sign-in). Use this instead of the legacy
 * raw-neutral card boxes, and never nest one Panel in another (the app surface
 * separates by hairline, not by stacked boxes).
 */
export function Panel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md border border-border bg-card p-3", className)}
      {...props}
    />
  );
}

/** Quiet uppercase section eyebrow — the standard small heading above a group. */
export function SectionHeading({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "mb-2 text-meta font-medium uppercase tracking-wider text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
