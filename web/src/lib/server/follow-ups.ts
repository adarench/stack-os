import "server-only";
import { z } from "zod";
import { and, asc, eq, isNull, lte, or, sql as drizzleSql } from "drizzle-orm";
import { followUps } from "@db/schema/follow-ups";
import { users } from "@db/schema/users";
import { workOrders } from "@db/schema/work-orders";
import { withStaffScope, type ScopedDB } from "./db";
import { ensureUserRow } from "./sync-user";
import type { PolymorphicTarget } from "@contracts/polymorphic";

export type FollowUpSource = "trello" | "email" | "text" | "appfolio" | "manual";

export interface FollowUpLaneItem {
  id: string;
  title: string;
  sourceChannel: FollowUpSource;
  sourceUrl: string | null;
  nextAction: string | null;
  ownerName: string | null;
  followUpAt: string | null;
  lastTouchedAt: string | null;
  /** Drawer-openable ref when the follow-up is attached to a WO. */
  targetRef: string | null;
}

/**
 * Open (or snoozed-but-now-due) follow-ups for the /now lane. Due items first
 * (soonest follow_up_at), then stalest-touched — so the thing most likely to
 * fall through the cracks floats up.
 */
export async function listFollowUpsForLane(
  now: Date = new Date(),
): Promise<FollowUpLaneItem[]> {
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select({
        id: followUps.id,
        title: followUps.title,
        sourceChannel: followUps.sourceChannel,
        sourceUrl: followUps.sourceUrl,
        nextAction: followUps.nextAction,
        followUpAt: followUps.followUpAt,
        lastTouchedAt: followUps.lastTouchedAt,
        targetType: followUps.targetType,
        ownerName: users.name,
        ownerEmail: users.email,
        woNumber: workOrders.number,
      })
      .from(followUps)
      .leftJoin(users, eq(users.id, followUps.ownerUserId))
      .leftJoin(
        workOrders,
        and(
          eq(workOrders.id, followUps.targetId),
          eq(followUps.targetType, "work_order"),
        ),
      )
      .where(
        and(
          eq(followUps.orgId, ctx.orgId),
          isNull(followUps.deletedAt),
          or(
            eq(followUps.status, "open"),
            and(
              eq(followUps.status, "snoozed"),
              lte(followUps.followUpAt, now),
            ),
          ),
        ),
      )
      .orderBy(asc(followUps.followUpAt), asc(followUps.lastTouchedAt))
      .limit(50);

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      sourceChannel: r.sourceChannel as FollowUpSource,
      sourceUrl: r.sourceUrl,
      nextAction: r.nextAction,
      ownerName: r.ownerName ?? (r.ownerEmail ? r.ownerEmail.split("@")[0]! : null),
      followUpAt: r.followUpAt ? r.followUpAt.toISOString() : null,
      lastTouchedAt: r.lastTouchedAt ? r.lastTouchedAt.toISOString() : null,
      targetRef: r.woNumber != null ? `WO-${r.woNumber}` : null,
    }));
  });
}

export const createFollowUpInput = z.object({
  title: z.string().min(1).max(500),
  nextAction: z.string().max(500).optional(),
  sourceChannel: z
    .enum(["trello", "email", "text", "appfolio", "manual"])
    .default("manual"),
  sourceUrl: z.string().max(2000).optional(),
  externalId: z.string().max(200).optional(),
  targetType: z.string().optional(),
  targetId: z.string().uuid().optional(),
  followUpAt: z.coerce.date().optional(),
  assignToMe: z.boolean().optional(),
});

export async function createFollowUp(input: z.input<typeof createFollowUpInput>) {
  const p = createFollowUpInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const ownerUserId = p.assignToMe
      ? await ensureUserRow(tx, ctx.orgId, ctx.userId)
      : null;
    const now = new Date();
    const [row] = await tx
      .insert(followUps)
      .values({
        orgId: ctx.orgId,
        title: p.title,
        nextAction: p.nextAction ?? null,
        sourceChannel: p.sourceChannel,
        sourceUrl: p.sourceUrl ?? null,
        externalId: p.externalId ?? null,
        targetType: (p.targetType as PolymorphicTarget) ?? null,
        targetId: p.targetId ?? null,
        followUpAt: p.followUpAt ?? null,
        ownerUserId,
        lastTouchedAt: now,
      })
      .returning({ id: followUps.id });
    return row!.id;
  });
}

/** Mark a follow-up handled. */
export async function resolveFollowUp(followUpId: string): Promise<void> {
  await withStaffScope(async (tx, ctx) => {
    await touch(tx, ctx.orgId, followUpId, {
      status: "done",
      resolvedAt: new Date(),
    });
  });
}

/** Snooze a follow-up forward by N days (resurfaces when due). */
export async function snoozeFollowUp(
  followUpId: string,
  days: number,
): Promise<void> {
  await withStaffScope(async (tx, ctx) => {
    const until = new Date(Date.now() + days * 86_400_000);
    await touch(tx, ctx.orgId, followUpId, {
      status: "snoozed",
      followUpAt: until,
    });
  });
}

async function touch(
  tx: ScopedDB,
  orgId: string,
  followUpId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await tx
    .update(followUps)
    .set({ ...patch, lastTouchedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(followUps.orgId, orgId), eq(followUps.id, followUpId)));
}

/** Count for the nav/summary if needed later. */
export async function countOpenFollowUps(): Promise<number> {
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select({ n: drizzleSql<string>`count(*)::text` })
      .from(followUps)
      .where(
        and(
          eq(followUps.orgId, ctx.orgId),
          isNull(followUps.deletedAt),
          eq(followUps.status, "open"),
        ),
      );
    return Number(rows[0]?.n ?? 0);
  });
}
