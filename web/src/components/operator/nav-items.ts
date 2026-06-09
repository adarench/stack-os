import {
  type LucideIcon,
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
 * The morning-triage loop. PRIMARY is the three surfaces a PM runs their day
 * from: /now (the command view), /work (the queue detail), /compliance (the
 * vendor detail). /money is demoted to secondary — approvals are actioned
 * inline from the /now lane + drawer, so it's a supporting surface, not a
 * daily destination. /inbox is hidden until email/text actually feed it.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/now", label: "Now", icon: Activity, mobile: true },
  { href: "/work", label: "Work", icon: ListTodo, mobile: true, badgeKey: "overdue" },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck, mobile: true, badgeKey: "cois_30d" },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/money", label: "Money", icon: Wallet, badgeKey: "needs" },
];
export const FOOT_NAV: NavItem[] = [];
