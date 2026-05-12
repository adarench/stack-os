"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV } from "./nav-items";

const MOBILE_TABS = PRIMARY_NAV.filter((item) => item.mobile);

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Bottom tab bar — mobile only. 4 destinations max. "More" slot holds
 * everything else (Money, Settings, Inbox, sign out, help).
 */
export function BottomTabBar({
  onOpenMore,
}: {
  onOpenMore?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-30 flex h-14 items-stretch border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-label="Primary"
    >
      {MOBILE_TABS.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium uppercase tracking-wide",
              active ? "text-foreground" : "text-muted-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-urgency-brand"
              />
            )}
            <Icon className="size-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onOpenMore}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        aria-label="More"
      >
        <MoreHorizontal className="size-5" />
        <span>More</span>
      </button>
    </nav>
  );
}
