/**
 * Pure formatting helpers — no runtime deps. Used by server components and
 * client components.
 */

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "2h ago" / "3d ago" / "just now". Past dates only; future dates render
 * as their absolute date.
 */
export function relativeTime(d: Date | string | number, now: Date = new Date()): string {
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = now.getTime() - t;
  if (diff < 0) return new Date(t).toLocaleDateString();
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(t).toLocaleDateString();
}
