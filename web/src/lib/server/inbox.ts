import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { notifications } from "@db/schema/notifications";
import { workOrders } from "@db/schema/work-orders";
import { inspections } from "@db/schema/inspections";
import { projects } from "@db/schema/projects";
import { withStaffScope, type ScopedDB } from "./db";
import { ensureUserRow } from "./sync-user";

export interface InboxNotification {
  id: string;
  kind: string;
  subject: string;
  body: string;
  channel: string;
  targetType: string | null;
  targetId: string | null;
  /** Human-readable ref the dispatcher recognizes — `WO-1043`, `INS-AB12CD`,
   *  `PRJ-...`. Null when the notification has no target or the target is a
   *  type the inbox doesn't surface (vendor, property, etc.). */
  targetRef: string | null;
  at: string;
  /** A coarse "unread" signal: appeared in the last 24h. v1 has no per-user
   *  read-state column, so we approximate. */
  unread: boolean;
}

export interface InboxSummary {
  total: number;
  unread: number;
}

const UNREAD_HORIZON_HOURS = 24;

function unreadCutoff(now: Date): Date {
  return new Date(now.getTime() - UNREAD_HORIZON_HOURS * 60 * 60 * 1000);
}

/**
 * Loads the inbox for the signed-in staff user. v1: no per-user read flag,
 * so "unread" approximates as "delivered in the last 24h". Real read-state
 * lands when the notifications table grows a `read_at` column.
 *
 * Each notification gets a resolved `targetRef` — the human ref the
 * dispatcher recognizes (WO-1043, INS-AB12CD, PRJ-...). Resolution is one
 * extra query per target type, which is acceptable since the inbox list
 * caps at the page limit.
 */
export async function loadInbox(
  limit = 50,
  now: Date = new Date(),
): Promise<InboxNotification[]> {
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const cutoff = unreadCutoff(now);
    const rows = await tx
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.orgId, ctx.orgId),
          eq(notifications.recipientUserId, userId),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    const refMap = await resolveTargetRefs(tx, ctx.orgId, rows);

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      subject: r.subject,
      body: r.body,
      channel: r.channel,
      targetType: r.targetType,
      targetId: r.targetId,
      targetRef:
        r.targetType && r.targetId
          ? refMap.get(`${r.targetType}:${r.targetId}`) ?? null
          : null,
      at: r.createdAt.toISOString(),
      unread: r.createdAt >= cutoff,
    }));
  });
}

async function resolveTargetRefs(
  tx: ScopedDB,
  orgId: string,
  rows: Array<{ targetType: string | null; targetId: string | null }>,
): Promise<Map<string, string>> {
  const byType: Record<string, string[]> = {};
  for (const r of rows) {
    if (!r.targetType || !r.targetId) continue;
    (byType[r.targetType] ||= []).push(r.targetId);
  }
  const out = new Map<string, string>();

  if (byType.work_order?.length) {
    const woRows = await tx
      .select({ id: workOrders.id, number: workOrders.number })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.orgId, orgId),
          inArray(workOrders.id, byType.work_order),
        ),
      );
    for (const w of woRows) {
      out.set(`work_order:${w.id}`, `WO-${w.number}`);
    }
  }

  if (byType.inspection?.length) {
    const insRows = await tx
      .select({ id: inspections.id })
      .from(inspections)
      .where(
        and(
          eq(inspections.orgId, orgId),
          inArray(inspections.id, byType.inspection),
        ),
      );
    for (const i of insRows) {
      out.set(`inspection:${i.id}`, `INS-${i.id.slice(0, 6).toUpperCase()}`);
    }
  }

  if (byType.project?.length) {
    const prjRows = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.orgId, orgId), inArray(projects.id, byType.project)),
      );
    for (const p of prjRows) {
      out.set(`project:${p.id}`, `PRJ-${p.id.slice(0, 6).toUpperCase()}`);
    }
  }

  return out;
}

export async function loadInboxSummary(
  now: Date = new Date(),
): Promise<InboxSummary> {
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const cutoff = unreadCutoff(now);
    const all = await tx
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.orgId, ctx.orgId),
          eq(notifications.recipientUserId, userId),
        ),
      );
    const unread = all.filter((r) => r.createdAt >= cutoff).length;
    return { total: all.length, unread };
  });
}
