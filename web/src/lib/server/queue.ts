import "server-only";
import { and, desc, eq, gte, lt, lte, sql as drizzleSql } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { inspections } from "@db/schema/inspections";
import { approvals } from "@db/schema/approvals";
import { properties } from "@db/schema/properties";
import { units } from "@db/schema/units";
import { vendorCois } from "@db/schema/compliance";
import { withStaffScope, type ScopedDB } from "./db";
import type { Urgency } from "../../components/operator/urgency-dot";

/**
 * Cross-entity queue. Powers /now and the bell badge.
 *
 * v1 implementation: fan-out + merge in-memory (no UNION view, no
 * materialized view). Each lane is a tight RLS-scoped query. The lane
 * concept is a UI device — the queue is sliced by status + due-time across
 * work_orders, inspections, and approvals.
 *
 * Future: when cross-entity full-text search dominates latency, promote
 * to a `activity_unified` SQL view. Until then, fan-out keeps the lane
 * logic in TS where it can evolve quickly.
 */

export type QueueLane =
  | "needs"
  | "overdue"
  | "blocked"
  | "today"
  | "inflight"
  | "changed";

export interface QueueItem {
  ref: string;
  type: "wo" | "ins" | "prj" | "approval";
  title: string;
  status: string;
  /** Work-order priority — drives the urgency badge on rows. Inspections
   *  and approvals don't have it. */
  priority: "low" | "normal" | "high" | "urgent" | null;
  ownerName: string | null;
  property: string | null;
  unit: string | null;
  dueAt: string | null;
  lastActionAt: string;
  lastActionText: string | null;
  urgency: Urgency;
  /** Legacy detail URL during the migration window. */
  legacyHref: string;
}

export interface QueueSummary {
  counts: Record<QueueLane, number>;
  pulse: {
    openWOs: number;
    overdue: number;
    coisExpiring30d: number;
    pendingApprovals: number;
  };
}

const LANE_LIMIT = 25;

const TERMINAL_WO = ["closed", "cancelled"] as const;

function todayBounds(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/* -------------------- summary -------------------- */

export async function loadQueueSummary(
  now: Date = new Date(),
): Promise<QueueSummary> {
  return withStaffScope(async (tx, ctx) => {
    const orgId = ctx.orgId;

    // Each count is a single COUNT(*) — six lanes + pulse stats.
    const openWOs = await countWO(
      tx,
      orgId,
      drizzleSql`${workOrders.status} NOT IN ('closed', 'cancelled')`,
    );
    const overdue = await countWO(
      tx,
      orgId,
      and(
        lt(workOrders.dueAt, now),
        // Match overdueLane filter — resolved/verified are awaiting
        // closeout, not blocking field work.
        drizzleSql`${workOrders.status} NOT IN ('closed', 'cancelled', 'resolved', 'verified')`,
      ),
    );
    const blocked = await countWO(tx, orgId, eq(workOrders.status, "blocked"));
    const { start, end } = todayBounds(now);
    const today = await countWO(
      tx,
      orgId,
      and(
        gte(workOrders.dueAt, start),
        lt(workOrders.dueAt, end),
        drizzleSql`${workOrders.status} NOT IN ('closed', 'cancelled')`,
      ),
    );
    const inflight = await countWO(
      tx,
      orgId,
      eq(workOrders.status, "in_progress"),
    );
    const changed = await countWO(
      tx,
      orgId,
      gte(workOrders.updatedAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
    );
    const needsRows = await tx
      .select({ n: drizzleSql<string>`count(*)::text` })
      .from(approvals)
      .where(and(eq(approvals.orgId, orgId), eq(approvals.status, "pending")));
    const needs = Number(needsRows[0]?.n ?? 0);

    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const coisExpiringRows = await tx
      .select({ n: drizzleSql<string>`count(*)::text` })
      .from(vendorCois)
      .where(
        and(eq(vendorCois.orgId, orgId), lte(vendorCois.expiresAt, thirtyDays)),
      );
    const coisExpiring = Number(coisExpiringRows[0]?.n ?? 0);

    return {
      counts: {
        needs,
        overdue,
        blocked,
        today,
        inflight,
        changed,
      },
      pulse: {
        openWOs,
        overdue,
        coisExpiring30d: coisExpiring,
        pendingApprovals: needs,
      },
    };
  });
}

/* -------------------- lanes -------------------- */

export async function loadQueueLane(
  lane: QueueLane,
  now: Date = new Date(),
): Promise<QueueItem[]> {
  return withStaffScope(async (tx, ctx) => {
    switch (lane) {
      case "overdue":
        return overdueLane(tx, ctx.orgId, now);
      case "blocked":
        return blockedLane(tx, ctx.orgId);
      case "today":
        return todayLane(tx, ctx.orgId, now);
      case "inflight":
        return inflightLane(tx, ctx.orgId);
      case "changed":
        return changedLane(tx, ctx.orgId, now);
      case "needs":
        return needsLane(tx, ctx.orgId);
    }
  });
}

async function overdueLane(
  tx: ScopedDB,
  orgId: string,
  now: Date,
): Promise<QueueItem[]> {
  // Audit fix: exclude resolved + verified — work that's done from the
  // vendor side, just awaiting closeout, is not "overdue" for the
  // dispatcher. Their right surface is a future "verify" queue, not /now.
  const woRows = await woQuery(tx)
    .where(
      and(
        eq(workOrders.orgId, orgId),
        lt(workOrders.dueAt, now),
        drizzleSql`${workOrders.status} NOT IN ('closed', 'cancelled', 'resolved', 'verified')`,
      ),
    )
    .orderBy(
      // Audit fix: priority DESC first, then oldest-due, so urgent rises.
      drizzleSql`case ${workOrders.priority}
                   when 'urgent' then 0
                   when 'high'   then 1
                   when 'normal' then 2
                   when 'low'    then 3
                   else 4 end`,
      workOrders.dueAt,
    )
    .limit(LANE_LIMIT);

  // Audit fix: surface overdue inspections in the same lane — previously
  // invisible. A 'scheduled' inspection past its scheduled_for is an
  // operational miss the dispatcher must see.
  const insRows = await insQuery(tx)
    .where(
      and(
        eq(inspections.orgId, orgId),
        lt(inspections.scheduledFor, now),
        eq(inspections.status, "scheduled"),
      ),
    )
    .orderBy(inspections.scheduledFor)
    .limit(LANE_LIMIT);

  return [
    ...woRows.map((r) => mapWO(r, "overdue")),
    ...insRows.map((r) => mapIns(r, "overdue")),
  ];
}

async function blockedLane(
  tx: ScopedDB,
  orgId: string,
): Promise<QueueItem[]> {
  const rows = await woQuery(tx)
    .where(and(eq(workOrders.orgId, orgId), eq(workOrders.status, "blocked")))
    .orderBy(desc(workOrders.updatedAt))
    .limit(LANE_LIMIT);
  return rows.map((r) => mapWO(r, "blocked"));
}

async function todayLane(
  tx: ScopedDB,
  orgId: string,
  now: Date,
): Promise<QueueItem[]> {
  const { start, end } = todayBounds(now);
  const woRows = await woQuery(tx)
    .where(
      and(
        eq(workOrders.orgId, orgId),
        gte(workOrders.dueAt, start),
        lt(workOrders.dueAt, end),
        drizzleSql`${workOrders.status} NOT IN ('closed', 'cancelled')`,
      ),
    )
    .orderBy(workOrders.dueAt)
    .limit(LANE_LIMIT);
  const insRows = await insQuery(tx)
    .where(
      and(
        eq(inspections.orgId, orgId),
        gte(inspections.scheduledFor, start),
        lt(inspections.scheduledFor, end),
        eq(inspections.status, "scheduled"),
      ),
    )
    .orderBy(inspections.scheduledFor)
    .limit(LANE_LIMIT);
  return [
    ...woRows.map((r) => mapWO(r, "today")),
    ...insRows.map((r) => mapIns(r, "today")),
  ].sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
}

async function inflightLane(
  tx: ScopedDB,
  orgId: string,
): Promise<QueueItem[]> {
  const woRows = await woQuery(tx)
    .where(
      and(eq(workOrders.orgId, orgId), eq(workOrders.status, "in_progress")),
    )
    .orderBy(desc(workOrders.updatedAt))
    .limit(LANE_LIMIT);
  const insRows = await insQuery(tx)
    .where(
      and(
        eq(inspections.orgId, orgId),
        eq(inspections.status, "in_progress"),
      ),
    )
    .orderBy(desc(inspections.updatedAt))
    .limit(LANE_LIMIT);
  return [
    ...woRows.map((r) => mapWO(r, "inflow")),
    ...insRows.map((r) => mapIns(r, "inflow")),
  ].sort(byUpdatedDesc);
}

async function changedLane(
  tx: ScopedDB,
  orgId: string,
  now: Date,
): Promise<QueueItem[]> {
  // "Just changed" = anything that moved in the last 24h, including fresh
  // creates. (An earlier audit pass tried to filter out create-only rows,
  // but that hid newly-filed WOs the dispatcher needs to see — they
  // wouldn't otherwise appear on /now unless they happened to be overdue
  // or in_progress.) The lastActionText chip on each row already
  // distinguishes "new" from "in progress" / "blocked" / etc.
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const woRows = await woQuery(tx)
    .where(
      and(eq(workOrders.orgId, orgId), gte(workOrders.updatedAt, since)),
    )
    .orderBy(desc(workOrders.updatedAt))
    .limit(LANE_LIMIT);
  const insRows = await insQuery(tx)
    .where(
      and(
        eq(inspections.orgId, orgId),
        gte(inspections.updatedAt, since),
      ),
    )
    .orderBy(desc(inspections.updatedAt))
    .limit(LANE_LIMIT);
  return [
    ...woRows.map((r) => mapWO(r, "muted")),
    ...insRows.map((r) => mapIns(r, "muted")),
  ].sort(byUpdatedDesc);
}

async function needsLane(
  tx: ScopedDB,
  orgId: string,
): Promise<QueueItem[]> {
  // Approvals targeting a WO — joined to surface the underlying WO number.
  const rows = await tx
    .select({
      id: approvals.id,
      reason: approvals.reason,
      amount: approvals.amountCents,
      updatedAt: approvals.updatedAt,
      targetId: approvals.targetId,
      woNumber: workOrders.number,
      woTitle: workOrders.title,
      propertyName: properties.name,
      unitLabel: units.label,
    })
    .from(approvals)
    .leftJoin(workOrders, eq(workOrders.id, approvals.targetId))
    .leftJoin(properties, eq(properties.id, workOrders.propertyId))
    .leftJoin(units, eq(units.id, workOrders.unitId))
    .where(and(eq(approvals.orgId, orgId), eq(approvals.status, "pending")))
    .orderBy(desc(approvals.updatedAt))
    .limit(LANE_LIMIT);

  return rows.map((r): QueueItem => {
    const woRef = r.woNumber ? `WO-${r.woNumber}` : `AP-${shortId(r.targetId)}`;
    const ref = `AP-${shortId(r.id)}`;
    const amount = r.amount ? ` · $${(Number(r.amount) / 100).toFixed(0)}` : "";
    return {
      ref,
      type: "approval",
      title: `Approval (${r.reason})${amount} — ${woRef}`,
      status: "pending",
      priority: null,
      ownerName: null,
      property: r.propertyName,
      unit: r.unitLabel,
      dueAt: null,
      lastActionAt: r.updatedAt.toISOString(),
      lastActionText: "needs decision",
      urgency: "blocked",
      legacyHref: "/admin/approvals",
    };
  });
}

/* -------------------- mappers -------------------- */

interface WoRow {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueAt: Date | null;
  updatedAt: Date;
  propertyName: string | null;
  unitLabel: string | null;
}

interface InsRow {
  id: string;
  kind: string;
  status: string;
  scheduledFor: Date | null;
  updatedAt: Date;
  propertyName: string | null;
  unitLabel: string | null;
}

function woQuery(tx: ScopedDB) {
  return tx
    .select({
      id: workOrders.id,
      number: workOrders.number,
      title: workOrders.title,
      status: workOrders.status,
      priority: workOrders.priority,
      dueAt: workOrders.dueAt,
      updatedAt: workOrders.updatedAt,
      propertyName: properties.name,
      unitLabel: units.label,
    })
    .from(workOrders)
    .leftJoin(properties, eq(properties.id, workOrders.propertyId))
    .leftJoin(units, eq(units.id, workOrders.unitId));
}

function insQuery(tx: ScopedDB) {
  return tx
    .select({
      id: inspections.id,
      kind: inspections.kind,
      status: inspections.status,
      scheduledFor: inspections.scheduledFor,
      updatedAt: inspections.updatedAt,
      propertyName: properties.name,
      unitLabel: units.label,
    })
    .from(inspections)
    .leftJoin(properties, eq(properties.id, inspections.propertyId))
    .leftJoin(units, eq(units.id, inspections.unitId));
}

function mapWO(r: WoRow, urgency: Urgency): QueueItem {
  return {
    ref: `WO-${r.number}`,
    type: "wo",
    title: r.title,
    status: r.status,
    priority: r.priority,
    ownerName: null,
    property: r.propertyName,
    unit: r.unitLabel,
    dueAt: r.dueAt ? r.dueAt.toISOString() : null,
    lastActionAt: r.updatedAt.toISOString(),
    lastActionText: lastActionForStatus(r.status),
    urgency,
    legacyHref: `/work-orders/${r.id}`,
  };
}

function mapIns(r: InsRow, urgency: Urgency): QueueItem {
  const kindLabel = r.kind.replace(/_/g, " ");
  return {
    ref: `INS-${shortId(r.id)}`,
    type: "ins",
    title: `${capitalize(kindLabel)} inspection`,
    status: r.status,
    priority: null,
    ownerName: null,
    property: r.propertyName,
    unit: r.unitLabel,
    dueAt: r.scheduledFor ? r.scheduledFor.toISOString() : null,
    lastActionAt: r.updatedAt.toISOString(),
    lastActionText: r.status,
    urgency,
    legacyHref: `/inspections/${r.id}`,
  };
}

function lastActionForStatus(status: string): string | null {
  if (status === "in_progress") return "in progress";
  if (status === "blocked") return "blocked";
  if (status === "scheduled") return "scheduled";
  if (status === "assigned") return "assigned";
  if (status === "new") return "new";
  return null;
}

function shortId(id: string | null | undefined): string {
  return (id ?? "").slice(0, 6).toUpperCase();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function byUpdatedDesc(a: QueueItem, b: QueueItem): number {
  return b.lastActionAt.localeCompare(a.lastActionAt);
}

/* -------------------- helpers -------------------- */

async function countWO(
  tx: ScopedDB,
  orgId: string,
  filter: ReturnType<typeof and> | ReturnType<typeof eq>,
): Promise<number> {
  const rows = await tx
    .select({ n: drizzleSql<string>`count(*)::text` })
    .from(workOrders)
    .where(and(eq(workOrders.orgId, orgId), filter as never));
  return Number(rows[0]?.n ?? 0);
}

