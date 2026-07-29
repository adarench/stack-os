"use client";

import * as React from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Plus, LogOut } from "lucide-react";
import { unsubscribePush } from "@/lib/push-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCommandPalette } from "./command-palette";
import {
  PRIMARY_NAV,
  SECONDARY_NAV,
  UTILITY_NAV,
  ADMIN_NAV,
  type NavItem,
} from "./nav-items";

// Primary destinations that aren't in the mobile tab bar (e.g. Projects) still
// need a mobile home — surface them at the top of the sheet.
const WORK_EXTRAS = PRIMARY_NAV.filter((i) => !i.mobile);

/**
 * Mobile "More" sheet — the destination for everything outside the four bottom
 * tabs. Before this, the tab bar's More button was a dead no-op, so on a phone
 * Buildings/Reports/Money/Compliance/Inbox/admin were unreachable except via
 * the command palette. Bottom sheet keeps it thumb-friendly.
 */
export function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { setOpen: setCommandOpen } = useCommandPalette();
  const close = () => onOpenChange(false);

  const row = (item: NavItem) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={close}
        className="flex items-center gap-3 rounded-md px-2 py-2.5 text-body text-foreground hover:bg-accent"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85svh] overflow-y-auto rounded-t-xl p-0"
      >
        <SheetHeader>
          <SheetTitle>More</SheetTitle>
        </SheetHeader>
        <div className="p-2">
          <button
            type="button"
            onClick={() => {
              close();
              setCommandOpen(true);
            }}
            className="mb-2 flex w-full items-center gap-3 rounded-md bg-foreground px-2 py-2.5 text-body font-medium text-background"
          >
            <Plus className="size-4" />
            New…
          </button>

          {WORK_EXTRAS.length > 0 && (
            <Section label="Work">{WORK_EXTRAS.map(row)}</Section>
          )}
          <Section label="Portfolio">{SECONDARY_NAV.map(row)}</Section>
          <Section label="Operations">{UTILITY_NAV.map(row)}</Section>
          <Section label="Admin">{ADMIN_NAV.map(row)}</Section>

          <div className="mt-2 border-t border-border pt-2">
            <button
              type="button"
              onClick={async () => { await unsubscribePush("/api/me/push/subscribe"); signOut({ redirectTo: "/sign-in" }); }}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-body text-foreground hover:bg-accent"
            >
              <LogOut className="size-4 shrink-0 text-muted-foreground" />
              Sign out
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="px-2 pb-1 pt-2 text-meta font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </div>
      {children}
    </div>
  );
}
