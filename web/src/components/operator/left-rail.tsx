"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FOOT_NAV,
  PRIMARY_NAV,
  SECONDARY_NAV,
  type NavItem,
} from "./nav-items";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function RailLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          className={cn(
            "group relative flex h-8 items-center gap-3 rounded-md px-2 text-sm transition-colors",
            active
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          aria-current={active ? "page" : undefined}
        >
          {active && (
            <span
              aria-hidden
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-urgency-brand"
            />
          )}
          <Icon className="size-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Left rail — desktop only. 200px wide. Items hold the operator's primary
 * destinations; the active item paints a 2px accent on the left edge.
 */
export function LeftRail() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-[200px] shrink-0 flex-col border-r border-border bg-background">
      <nav className="flex-1 space-y-0.5 p-2">
        {PRIMARY_NAV.map((item) => (
          <RailLink key={item.href} item={item} pathname={pathname} />
        ))}
        {SECONDARY_NAV.length > 0 && (
          <>
            <Separator className="my-2" />
            {SECONDARY_NAV.map((item) => (
              <RailLink key={item.href} item={item} pathname={pathname} />
            ))}
          </>
        )}
      </nav>
      {FOOT_NAV.length > 0 && (
        <div className="p-2">
          {FOOT_NAV.map((item) => (
            <RailLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      )}
    </aside>
  );
}
