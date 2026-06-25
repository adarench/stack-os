import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The page container the operator shell never provides. Replaces the ~35
 * hand-rolled `<main className="mx-auto max-w-X p-Y">` wrappers (five
 * different widths) with one intentional set, a single gutter, and consistent
 * mobile clearance for the bottom tab bar.
 *
 * Renders a <div> by default (the shell already owns the scroll <main>);
 * standalone surfaces with no shell (vendor/tenant portals) pass as="main".
 */
const WIDTHS = {
  narrow: "max-w-lg", // small forms / record detail
  default: "max-w-3xl", // CRUD lists, properties, admin
  wide: "max-w-5xl", // tables — money, compliance
  full: "max-w-[1280px]", // the work list
} as const;

export type PageWidth = keyof typeof WIDTHS;

export function Page({
  width = "default",
  as: As = "div",
  className,
  children,
}: {
  width?: PageWidth;
  as?: "div" | "main";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <As
      className={cn(
        "mx-auto w-full px-3 py-3 md:px-4",
        "pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-10",
        WIDTHS[width],
        className,
      )}
    >
      {children}
    </As>
  );
}

/**
 * Standard page header: optional back-link (lucide, never a glyph), the single
 * PageTitle treatment (text-lg font-semibold tracking-tight — nothing in the
 * app should out-shout this), an optional eyebrow, and a right-aligned actions
 * slot.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  backHref,
  actions,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  backHref?: Route | string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-4", className)}>
      {backHref && (
        <Link
          href={backHref as Route}
          className="mb-2 inline-flex items-center gap-1 text-label text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 font-mono text-meta uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-body text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
