import "server-only";
import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import { notifications } from "@db/schema/notifications";
import { withStaffScope } from "./db";
import { ensureUserRow } from "./sync-user";

export interface InboxNotification {
  id: string;
  kind: string;
  subject: string;
  body: string;
  channel: string;
  targetType: string | null;
  targetId: string | null;
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
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      subject: r.subject,
      body: r.body,
      channel: r.channel,
      targetType: r.targetType,
      targetId: r.targetId,
      at: r.createdAt.toISOString(),
      unread: r.createdAt >= cutoff,
    }));
  });
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
