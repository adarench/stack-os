import {
  type LucideIcon,
  ListTodo,
  CalendarDays,
  ClipboardCheck,
  ShieldCheck,
  Wallet,
  Wrench,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Show on mobile bottom tab bar */
  mobile?: boolean;
  /** Operational badge — number of items demanding action on this surface. */
  badgeKey?: BadgeKey;
}

/** Counts that get piped from the layout's queue summary down to nav badges.
 *  Keep this small and operationally meaningful. */
export type BadgeKey =
  | "overdue"
  | "needs"
  | "blocked"
  | "cois_30d"
  | "unread";

/**
 * The maintenance-execution loop. PRIMARY is the surfaces the team runs
 * their day from:
 *   /my          — the technician's own open work ("what's on me")
 *   /work        — every work order, org-wide (the manager's view)
 *   /calendar    — recurring walks + scheduled work (the Trello replacement)
 *   /inspections — the recurring inspection flow
 *
 * Compliance and Money are SECONDARY — reachable from the rail / More menu,
 * not daily destinations. The old /dispatcher label is gone: it was a
 * redirect shell into /work, and "Work Orders" is the team's own word for
 * that surface. The old abstract /now pressure console is intentionally
 * absent: it redirects to /my and stays off the nav.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/my", label: "My Work", icon: ListTodo, mobile: true, badgeKey: "overdue" },
  { href: "/work", label: "Work Orders", icon: Wrench, mobile: true, badgeKey: "needs" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, mobile: true },
  { href: "/inspections", label: "Inspections", icon: ClipboardCheck, mobile: true },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/compliance", label: "Compliance", icon: ShieldCheck, badgeKey: "cois_30d" },
  { href: "/money", label: "Money", icon: Wallet, badgeKey: "needs" },
];
export const FOOT_NAV: NavItem[] = [];
