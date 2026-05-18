import {
  type LucideIcon,
  Inbox,
  ListTodo,
  Activity,
  ShieldCheck,
  Wallet,
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
 * Daily operational destinations. Five surfaces — the operator's loop.
 * Settings moved into the avatar dropdown (not a daily destination).
 * /board folded into /work?view=board; /dispatcher unlinked.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/now", label: "Now", icon: Activity, mobile: true },
  { href: "/work", label: "Work", icon: ListTodo, mobile: true, badgeKey: "overdue" },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck, mobile: true, badgeKey: "cois_30d" },
  { href: "/money", label: "Money", icon: Wallet, badgeKey: "needs" },
  { href: "/inbox", label: "Inbox", icon: Inbox, mobile: true, badgeKey: "unread" },
];

export const SECONDARY_NAV: NavItem[] = [];
export const FOOT_NAV: NavItem[] = [];
