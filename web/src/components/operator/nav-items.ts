import {
  type LucideIcon,
  ListTodo,
  CalendarDays,
  ClipboardCheck,
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
 * Work is the operating surface. PRIMARY is the work-lenses the team runs
 * their day from:
 *   /my          — the technician's own open work ("what's on me")
 *   /work        — every work order, org-wide (the manager's view)
 *   /calendar    — recurring walks + scheduled work (the Trello replacement)
 *   /inspections — the recurring inspection flow
 *
 * Property is the ontology (it powers routing/ownership/history) but is a
 * drill-in, not a daily tab. Compliance and Money are NOT nav: they have no
 * pull in this operation (zero mentions in the client review) and become
 * derived facets of a property later. Their routes stay live; they're just
 * not destinations. The old /dispatcher label and /now console are gone
 * (both redirect).
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/my", label: "My Work", icon: ListTodo, mobile: true, badgeKey: "overdue" },
  { href: "/work", label: "Work Orders", icon: Wrench, mobile: true, badgeKey: "needs" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, mobile: true },
  { href: "/inspections", label: "Inspections", icon: ClipboardCheck, mobile: true },
];

export const SECONDARY_NAV: NavItem[] = [];
export const FOOT_NAV: NavItem[] = [];
