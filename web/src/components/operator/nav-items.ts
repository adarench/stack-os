import {
  type LucideIcon,
  Inbox,
  ListTodo,
  Activity,
  ShieldCheck,
  Wallet,
  Settings as SettingsIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Show on mobile bottom tab bar */
  mobile?: boolean;
}

/** Primary destinations — appear on left rail and (a subset of) bottom tab bar. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/now", label: "Now", icon: Activity, mobile: true },
  { href: "/work", label: "Work", icon: ListTodo, mobile: true },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck, mobile: true },
  { href: "/money", label: "Money", icon: Wallet },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

/** Secondary rail items, below a separator. Only fully-realised surfaces
 *  belong here — placeholders break demo immersion. /subscriptions and
 *  /help routes still exist for direct-URL access during the cutover, but
 *  are not surfaced in the rail. */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
];

/** Foot of rail. Empty for now — Help / shortcuts dialog will land here
 *  when it has real content. */
export const FOOT_NAV: NavItem[] = [];
