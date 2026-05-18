import "server-only";
import { loadQueueSummary } from "./queue";
import { loadInboxSummary } from "./inbox";
import { loadQueueLane } from "./queue";

/**
 * Operational counts that ride along with the persistent shell (status line,
 * left-rail badges). Computed once per request from the same scoped queries
 * the individual surfaces use — there's no separate "shell" data model.
 *
 * `oldestOverdueMs` is computed from the actual overdue lane because the
 * queue summary doesn't carry it. One extra small query; acceptable.
 */
export interface ShellSummary {
  open: number;
  overdue: number;
  blocked: number;
  needs: number;
  cois30d: number;
  oldestOverdueMs: number | null;
  unread: number;
}

export async function loadShellSummary(): Promise<ShellSummary> {
  const [summary, inbox, overdueItems] = await Promise.all([
    loadQueueSummary(),
    loadInboxSummary(),
    loadQueueLane("overdue"),
  ]);

  const now = Date.now();
  const oldestOverdueMs = overdueItems.reduce<number | null>((max, it) => {
    const ms = now - new Date(it.lastActionAt).getTime();
    if (ms <= 0) return max;
    if (max === null || ms > max) return ms;
    return max;
  }, null);

  return {
    open: summary.pulse.openWOs,
    overdue: summary.pulse.overdue,
    blocked: summary.counts.blocked,
    needs: summary.pulse.pendingApprovals,
    cois30d: summary.pulse.coisExpiring30d,
    oldestOverdueMs,
    unread: inbox.unread,
  };
}
