import {
  type LucideIcon,
  ListTodo,
  CalendarDays,
  ClipboardCheck,
  Wrench,
  LayoutDashboard,
  Building2,
  Building,
  BarChart3,
  Wallet,
  Inbox,
  HardHat,
  Repeat,
  ListChecks,
  Users,
  FolderKanban,
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
  // Command — the portfolio-wide attention home (coordinator/manager lens).
  // Desktop rail + mobile More sheet; not a bottom tab (those stay at four).
  { href: "/command", label: "Command", icon: LayoutDashboard },
  { href: "/my", label: "My Work", icon: ListTodo, mobile: true, badgeKey: "overdue" },
  { href: "/work", label: "Work Orders", icon: Wrench, mobile: true, badgeKey: "needs" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, mobile: true },
  { href: "/inspections", label: "Inspections", icon: ClipboardCheck, mobile: true },
  // Projects/turns — a real work surface. Desktop rail only (mobile reaches it
  // via the More sheet's Work section) to keep the bottom tab bar at four.
  { href: "/projects", label: "Projects", icon: FolderKanban },
];

export const SECONDARY_NAV: NavItem[] = [
  // Buildings — per-building work-order triage (open work grouped by attention,
  // one building at a time). Distinct from Properties (history/reporting).
  { href: "/work/building", label: "Buildings", icon: Building },
  // Property is the ontology / a drill-in (history + reporting), not a daily
  // work-lens — so it lives in the secondary rail, not the primary tabs.
  { href: "/properties", label: "Properties", icon: Building2 },
  // Vendors & Compliance — vendor directory + COIs + the compliance monitor,
  // now one first-class area. Carries the COI-expiry badge.
  { href: "/vendors", label: "Vendors", icon: HardHat, badgeKey: "cois_30d" },
  // Reports — the v1 reporting dashboard (throughput, buildings, vendors, COI).
  { href: "/reports", label: "Reports", icon: BarChart3 },
];
export const FOOT_NAV: NavItem[] = [];

/**
 * Shared destinations that are NOT (yet) first-class rail items but must be
 * discoverable. Surfaced by the desktop account menu (top-bar) and the mobile
 * "More" sheet so the two stay in sync. Phase 2 promotes several of these
 * (Money/Vendors/Compliance) into the rail proper.
 */
export const UTILITY_NAV: NavItem[] = [
  { href: "/money", label: "Finance", icon: Wallet, badgeKey: "needs" },
  { href: "/inbox", label: "Inbox", icon: Inbox, badgeKey: "unread" },
];

/**
 * The admin / configuration layer. Previously reachable only by typing a URL
 * (or, for a couple, an incidental cross-link). Now surfaced together.
 */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/templates", label: "Recurring tasks", icon: Repeat },
  { href: "/admin/checklists", label: "Checklists", icon: ListChecks },
  { href: "/admin/properties", label: "Buildings & units", icon: Building2 },
  { href: "/admin/team", label: "Team", icon: Users },
];
