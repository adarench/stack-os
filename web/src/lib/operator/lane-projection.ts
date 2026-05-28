/**
 * Pure lane-projection logic. The /now page passes per-lane projection to
 * EntityRow; this module is the single source of truth for what each lane
 * looks like. See docs/design/lane_behavior_model.md.
 *
 * Kept in /lib/operator (not /lib/server) so it's pure + testable; the
 * server feeds it via a minimal input shape, no schema entanglement.
 */
import type { LaneProjection } from "@/components/operator/entity-row";

export type LaneKey =
  | "needs"
  | "overdue"
  | "blocked"
  | "today"
  | "inflight"
  | "changed";

/** Minimum data the projection logic needs to make per-row decisions. */
export interface ProjectionRow {
  ref: string;
  dueAt: string | null;
  lastActionAt: string;
}

/**
 * Build the lane projection for a given row in a given lane. Pass
 * `oldestRef` so OVERDUE pulses only on the single oldest row, and
 * `rowIndex` so OVERDUE's top-3 surface their consequence chip while
 * deep-lane rows stay quiet.
 *
 *   OVERDUE      red bar, pulse only oldest, consequence chip on top-3
 *   BLOCKED      amber bar always (never red), pulse off
 *   NEEDS YOU    brand (indigo) bar, no pulse, consequence chip on all
 *   IN-FLIGHT    no bar, no pulse — active work isn't urgency by definition
 *   JUST CHANGED no bar, receded contrast (ephemeral feel)
 *   TODAY        no bar, scheduled time on left, no pulse
 */
export function laneProjection(
  lane: LaneKey,
  row: ProjectionRow,
  oldestRef: string | null,
  rowIndex: number = 0,
): LaneProjection {
  switch (lane) {
    case "overdue":
      return {
        barTone: "red",
        pulse: row.ref === oldestRef,
        // Top 3 expand — consequence chip surfaces inline. Rest collapse so
        // density holds and the chip retains meaning.
        showConsequence: rowIndex < 3,
      };
    case "blocked":
      return { barTone: "amber", pulse: false };
    case "needs":
      return { barTone: "brand", pulse: false, showConsequence: true };
    case "inflight":
      return { suppressBar: true, pulse: false };
    case "today":
      return {
        suppressBar: true,
        pulse: false,
        timeAnchorLeft: !!row.dueAt,
      };
    case "changed":
      return { suppressBar: true, pulse: false, receded: true };
  }
}

/**
 * Per-lane background tint. 3–5% opacity — the cockpit stays calm; the lanes
 * just *feel* different in peripheral vision. Per
 * docs/design/cockpit_information_hierarchy.md.
 */
export function laneBgTint(lane: LaneKey): string {
  switch (lane) {
    case "overdue":
      return "bg-urgency-overdue/5";
    case "blocked":
      return "bg-urgency-blocked/[0.04]";
    case "needs":
      return "bg-urgency-brand/[0.03]";
    case "today":
      return "bg-urgency-inflow/[0.03]";
    case "inflight":
    case "changed":
      return "";
  }
}

/**
 * Pick the oldest row in a list by `dueAt ?? lastActionAt`. Returns null
 * for an empty list. Used to identify the single row that gets the pulse
 * in OVERDUE.
 */
export function oldestRef(
  rows: ProjectionRow[],
  now: number = Date.now(),
): string | null {
  let oldest = 0;
  let ref: string | null = null;
  for (const r of rows) {
    const anchor = r.dueAt ?? r.lastActionAt;
    const ms = now - new Date(anchor).getTime();
    if (ms > oldest) {
      oldest = ms;
      ref = r.ref;
    }
  }
  return ref;
}

/**
 * Compact action-verb summary for the JUST CHANGED lane aside —
 * "8 resolved · 4 assigned · 2 status". Lets the operator see the
 * morning's shape without scanning rows.
 */
export function verbSummary(items: Array<{ lastActionText?: string | null }>): string | null {
  const counts: Record<string, number> = {};
  for (const it of items) {
    const v = bucket(it.lastActionText ?? "");
    counts[v] = (counts[v] ?? 0) + 1;
  }
  const ordered = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (ordered.length === 0) return null;
  return ordered
    .slice(0, 3)
    .map(([verb, n]) => `${n} ${verb}`)
    .join(" · ");
}

export function bucket(text: string): string {
  const t = text.toLowerCase();
  if (/resolv|verifi|clos/.test(t)) return "resolved";
  if (/assign/.test(t)) return "assigned";
  if (/block/.test(t)) return "blocked";
  if (/comment/.test(t)) return "comments";
  if (/photo|upload/.test(t)) return "uploads";
  return "status";
}
