"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { House, CirclePlus, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { href: Route; label: string; icon: typeof House }[] = [
  { href: "/tenant" as Route, label: "Home", icon: House },
  { href: "/tenant/new" as Route, label: "Report", icon: CirclePlus },
  { href: "/tenant/insurance" as Route, label: "Coverage", icon: ShieldCheck },
];

/**
 * Tenant mobile bottom nav. Three destinations, big touch targets, sentence
 * case — deliberately simpler than the operator rail. "Report" is the center
 * primary action.
 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Tenant"
      className="sticky bottom-0 z-10 flex h-16 items-stretch border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active =
          tab.href === "/tenant"
            ? pathname === "/tenant"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-label font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className={cn("size-6", tab.label === "Report" && "size-7")} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
