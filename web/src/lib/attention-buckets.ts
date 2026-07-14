import type { WorkRow } from "@/lib/server/work-list";

/**
 * Attention buckets — the operator's escalating concern, derived from existing
 * fields (no backend change): not seen → seen-but-tenant-uninformed → in hand →
 * done. This is the spine of the operator console and the per-building surface.
 *
 * Section headers stay quiet — the per-row left bar already carries urgency and
 * the bucket order itself conveys the escalation. A small tone dot marks the
 * urgent buckets without colouring the whole label.
 */
export const ATTENTION_GROUPS = [
  { key: "unseen", label: "Not seen", tone: "text-muted-foreground", dot: "bg-urgency-overdue" },
  { key: "tenant", label: "Tenant waiting", tone: "text-muted-foreground", dot: "bg-urgency-blocked" },
  { key: "inhand", label: "Active", tone: "text-muted-foreground", dot: "" },
  { key: "done", label: "Done", tone: "text-muted-foreground", dot: "" },
] as const;

export type AttentionKey = (typeof ATTENTION_GROUPS)[number]["key"];

export function attentionBucket(r: WorkRow): AttentionKey {
  if (r.isOpen === false) return "done";
  if (!r.acknowledgedAt) return "unseen";
  if (!r.tenantUpdatedAt) return "tenant";
  return "inhand";
}

/** Within a group, the longest-waiting sits on top (oldest submission first). */
export function byAge(a: WorkRow, b: WorkRow): number {
  return (a.openedAt ?? a.lastActionAt).localeCompare(b.openedAt ?? b.lastActionAt);
}

/**
 * Group work rows into the attention buckets, oldest-first within each, and
 * drop empty buckets. Shared by /work and the per-building work surface so both
 * present the same spine.
 */
export function groupByAttention(rows: WorkRow[]) {
  return ATTENTION_GROUPS.map((g) => ({
    ...g,
    items: rows.filter((r) => attentionBucket(r) === g.key).sort(byAge),
  })).filter((g) => g.items.length > 0);
}
