import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";

/**
 * Centralizes the 2–3 reinvented filter-chip helpers. Sentence-case (no
 * uppercase shouting), rounded-md (not rounded-full — that's for true circles),
 * h-7 to sit on the control ladder. Active is a strong foreground fill;
 * inactive is a quiet hairline that lights up on hover.
 */
export function filterChipClass(active: boolean): string {
  return cn(
    "inline-flex h-7 items-center whitespace-nowrap rounded-md border px-3 text-label font-medium transition-colors",
    active
      ? "border-foreground bg-foreground text-background"
      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

export function FilterChip({
  href,
  active,
  className,
  children,
}: {
  href: Route | string;
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href as Route} className={cn(filterChipClass(active), className)}>
      {children}
    </Link>
  );
}

/** Horizontal scroller for a chip row — breaks the page gutter cleanly. */
export function FilterChipBar({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1 md:-mx-4 md:px-4",
        className,
      )}
      {...props}
    />
  );
}
