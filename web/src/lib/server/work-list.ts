import "server-only";
import { and, desc, eq, gte, ilike, isNull, lt, or, sql as drizzleSql, type SQL } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { inspections } from "@db/schema/inspections";
import { projects } from "@db/schema/projects";
import { properties } from "@db/schema/properties";
import { units } from "@db/schema/units";
import { assignments } from "@db/schema/assignments";
import { withStaffScope, type ScopedDB } from "./db";
import { workOrderCategoryLabel } from "@contracts/work-order-category";
import { loadActiveOwners } from "./owners";
import { type RowHint } from "./row-hints";
import { ensureUserRow } from "./sync-user";
import type { Urgency } from "../../components/operator/urgency-dot";
import { loadTurnStatuses, type TurnComputed } from "./turn-status";

/**
 * Unified work-list reader. Powers /work.
 *
 * v1 scope: type (wo/ins/prj/all) + status group + due window + free-text.
 * Owner filter and property typeahead come in a later pass once
 * assignments data is wired into the row mapper.
 */

export type WorkType = "wo" | "ins" | "prj" | "all";
export type DueFilter = "overdue" | "today" | "week" | "later" | "none" | "all";
export type StatusFilter = "open" | "blocked" | "in_progress" | "done" | "all";

export type MineFilter = "all" | "mine";

/** Open-age threshold for the "Aging" lens / "⚠ Xd old" flag (the call's
 *  "over seven days"). Based on submission age, not a due date. */
export const AGING_DAYS = 7;
const AGING_MS = AGING_DAYS * 24 * 60 * 60 * 1000;
/** WO statuses that count as "still open" for seen/tenant/aging signals. */
const OPEN_WO_STATUSES = ["new", "triaged", "assigned", "scheduled", "in_progress", "blocked"] as const;

export interface WorkListFilters {
  type?: WorkType;
  status?: StatusFilter;
  due?: DueFilter;
  q?: string;
  /** all (default) · mine (assigned to current user). Applied post-fetch. */
  mine?: MineFilter;
  /** Operator-model lenses (the call's surface), all WO-only:
   *   attention — open + not yet seen by the assigned tech
   *   tenant    — open + tenant not updated
   *   aging     — open + submitted over AGING_DAYS ago */
  attention?: boolean;
  tenant?: "not_updated";
  aging?: boolean;
  /** Structured filters (WO-only). assigneeId matches an active 'user' or
   *  'vendor'/'vendor_user' assignment; created range is on submission date. */
  propertyId?: string;
  unitId?: string;
  assigneeId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  limit?: number;
}

export interface WorkRow {
  /** Internal id — used for client-side filtering (e.g. "mine") and the
   *  upcoming hover-graph index. Not surfaced visually. */
  id: string;
  ref: string;
  type: "wo" | "ins" | "prj";
  title: string;
  status: string;
  priority: "low" | "normal" | "high" | "urgent" | null;
  ownerName: string | null;
  property: string | null;
  unit: string | null;
  /** Raw unit FK — lets the row pivot to the unit drawer (?d=UNT-…). */
  unitId: string | null;
  /** Raw property FK — lets a surface group/scope rows by building (WOs only). */
  propertyId?: string | null;
  dueAt: string | null;
  lastActionAt: string;
  lastActionText: string | null;
  urgency: Urgency;
  /** Open + over AGING_DAYS old by submission age (the "⚠ Xd old" flag). */
  aged: boolean;
  /** Operator-model row fields (WOs). The /work row foregrounds these.
   *  openedAt — submission time (drives age). acknowledgedAt — when the
   *  assigned tech first opened it ("seen"). tenantUpdatedAt — last
   *  tenant-visible note. isOpen — not completed/closed. */
  openedAt?: string;
  acknowledgedAt?: string | null;
  tenantUpdatedAt?: string | null;
  isOpen?: boolean;
  /** Submitted by a resident via the tenant app. */
  tenantReported?: boolean;
  /** Tenant-chosen issue category (humanized label), if any. */
  category?: string | null;
  /** Tier 3 row-level memory hints (max 2) — turns only now. */
  hints?: RowHint[];
  legacyHref: string;
}

const DEFAULT_LIMIT = 100;
const TERMINAL_WO = ["closed", "cancelled"] as const;

function todayBounds(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const weekEnd = new Date(start);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return { start, end, weekEnd };
}

export async function loadWorkList(
  filters: WorkListFilters = {},
  now: Date = new Date(),
): Promise<{ rows: WorkRow[]; total: number }> {
  const type = filters.type ?? "wo";
  const limit = filters.limit ?? DEFAULT_LIMIT;
  const mine = filters.mine ?? "all";

  return withStaffScope(async (tx, ctx) => {
    const orgId = ctx.orgId;

    const woRows = type === "wo" || type === "all"
      ? await queryWorkOrders(tx, orgId, filters, now, limit)
      : [];
    const insRows = type === "ins" || type === "all"
      ? await queryInspections(tx, orgId, filters, now, limit)
      : [];
    const prjRows = type === "prj" || type === "all"
      ? await queryProjects(tx, orgId, filters, now, limit)
      : [];

    // Merge + sort: pinned by urgency then by lastActionAt desc.
    let rows = [...woRows, ...insRows, ...prjRows].sort((a, b) => {
      if (a.urgency !== b.urgency) {
        return URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
      }
      return b.lastActionAt.localeCompare(a.lastActionAt);
    });

    // "Mine" filter — applied post-merge so all three entity types share the
    // same toggle. ("Unassigned" is gone: auto-assign-by-property means work
    // is never unassigned, so the lens would always be empty.)
    if (mine === "mine") {
      const userId = await ensureUserRow(tx, orgId, ctx.userId);
      const myTargetIds = await loadMyTargetIds(tx, orgId, userId);
      rows = rows.filter((r) => myTargetIds.has(r.id));
    }

    return { rows: rows.slice(0, limit), total: rows.length };
  });
}

/** Target ids (across all polymorphic types) currently assigned to a user. */
async function loadMyTargetIds(
  tx: ScopedDB,
  orgId: string,
  userId: string,
): Promise<Set<string>> {
  const rows = await tx
    .select({ targetId: assignments.targetId })
    .from(assignments)
    .where(
      and(
        eq(assignments.orgId, orgId),
        eq(assignments.assigneeType, "user"),
        eq(assignments.assigneeId, userId),
        isNull(assignments.unassignedAt),
      ),
    );
  return new Set(rows.map((r) => r.targetId));
}

const URGENCY_RANK: Record<Urgency, number> = {
  overdue: 0,
  blocked: 1,
  today: 2,
  inflow: 3,
  muted: 4,
  done: 5,
};

async function queryWorkOrders(
  tx: ScopedDB,
  orgId: string,
  f: WorkListFilters,
  now: Date,
  limit: number,
): Promise<WorkRow[]> {
  const where: SQL[] = [eq(workOrders.orgId, orgId)];

  if (f.status === "open") {
    where.push(drizzleSql`${workOrders.status} NOT IN ('closed', 'cancelled')`);
  } else if (f.status === "blocked") {
    where.push(eq(workOrders.status, "blocked"));
  } else if (f.status === "in_progress") {
    where.push(eq(workOrders.status, "in_progress"));
  } else if (f.status === "done") {
    where.push(drizzleSql`${workOrders.status} IN ('closed', 'verified')`);
  }

  // Operator-model lenses (the call's surface). Each implies "still open".
  const openSql = drizzleSql`${workOrders.status} IN ('new','triaged','assigned','scheduled','in_progress','blocked')`;
  if (f.attention) {
    // New / not yet seen by the assigned tech.
    where.push(openSql);
    where.push(isNull(workOrders.acknowledgedAt));
  }
  if (f.tenant === "not_updated") {
    where.push(openSql);
    where.push(isNull(workOrders.tenantUpdatedAt));
  }
  if (f.aging) {
    where.push(openSql);
    where.push(lt(workOrders.createdAt, new Date(now.getTime() - AGING_MS)));
  }

  // Structured filters (property / unit / created-date range / assignee).
  if (f.propertyId) where.push(eq(workOrders.propertyId, f.propertyId));
  if (f.unitId) where.push(eq(workOrders.unitId, f.unitId));
  if (f.createdFrom) where.push(gte(workOrders.createdAt, f.createdFrom));
  if (f.createdTo) where.push(lt(workOrders.createdAt, f.createdTo));
  if (f.assigneeId) {
    // WO has an active assignment to this person (staff user or vendor user).
    where.push(drizzleSql`EXISTS (
      SELECT 1 FROM ${assignments} a
      WHERE a.org_id = ${orgId}
        AND a.target_type = 'work_order'
        AND a.target_id = ${workOrders.id}
        AND a.assignee_id = ${f.assigneeId}
        AND a.unassigned_at IS NULL
    )`);
  }

  if (f.q) {
    const pat = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push(
      or(
        ilike(workOrders.title, pat),
        ilike(workOrders.description, pat),
      )!,
    );
  }

  const rows = await tx
    .select({
      id: workOrders.id,
      number: workOrders.number,
      title: workOrders.title,
      status: workOrders.status,
      priority: workOrders.priority,
      dueAt: workOrders.dueAt,
      createdAt: workOrders.createdAt,
      updatedAt: workOrders.updatedAt,
      acknowledgedAt: workOrders.acknowledgedAt,
      tenantUpdatedAt: workOrders.tenantUpdatedAt,
      unitId: workOrders.unitId,
      propertyId: workOrders.propertyId,
      spawnedFromInspectionId: workOrders.spawnedFromInspectionId,
      createdByActorType: workOrders.createdByActorType,
      category: workOrders.category,
      propertyName: properties.name,
      unitLabel: units.label,
    })
    .from(workOrders)
    .leftJoin(properties, eq(properties.id, workOrders.propertyId))
    .leftJoin(units, eq(units.id, workOrders.unitId))
    .where(and(...where))
    .orderBy(desc(workOrders.updatedAt))
    .limit(limit);

  // Assigned tech (active 'user' assignee) — promoted to a primary row field.
  // No row-hints here anymore: vendor-stress and "3rd at unit 90d" are gone
  // from the operator surface (they told the pressure story, not the call's).
  const owners = await loadActiveOwners(tx, orgId, "work_order", rows.map((r) => r.id));

  return rows.map((r): WorkRow => {
    const open = (OPEN_WO_STATUSES as readonly string[]).includes(r.status);
    const aged = open && now.getTime() - r.createdAt.getTime() > AGING_MS;
    return {
      id: r.id,
      ref: `WO-${r.number}`,
      type: "wo",
      title: r.title,
      status: r.status,
      priority: r.priority,
      ownerName: owners.get(r.id) ?? null,
      property: r.propertyName,
      unit: r.unitLabel,
      unitId: r.unitId,
      propertyId: r.propertyId,
      dueAt: r.dueAt ? r.dueAt.toISOString() : null,
      lastActionAt: r.updatedAt.toISOString(),
      lastActionText: lastActionForWO(r.status),
      urgency: woUrgency(r.status, r.dueAt, now),
      aged,
      openedAt: r.createdAt.toISOString(),
      acknowledgedAt: r.acknowledgedAt ? r.acknowledgedAt.toISOString() : null,
      tenantUpdatedAt: r.tenantUpdatedAt ? r.tenantUpdatedAt.toISOString() : null,
      isOpen: open,
      tenantReported: r.createdByActorType === "tenant",
      category: workOrderCategoryLabel(r.category),
      legacyHref: `/work-orders/${r.id}`,
    };
  });
}

async function queryInspections(
  tx: ScopedDB,
  orgId: string,
  f: WorkListFilters,
  now: Date,
  limit: number,
): Promise<WorkRow[]> {
  const where: SQL[] = [eq(inspections.orgId, orgId)];

  if (f.status === "open") {
    where.push(drizzleSql`${inspections.status} IN ('scheduled', 'in_progress')`);
  } else if (f.status === "in_progress") {
    where.push(eq(inspections.status, "in_progress"));
  } else if (f.status === "done") {
    where.push(drizzleSql`${inspections.status} IN ('completed', 'reviewed')`);
  }

  const { start, end, weekEnd } = todayBounds(now);
  if (f.due === "overdue") {
    where.push(lt(inspections.scheduledFor, now));
    where.push(eq(inspections.status, "scheduled"));
  } else if (f.due === "today") {
    where.push(gte(inspections.scheduledFor, start));
    where.push(lt(inspections.scheduledFor, end));
  } else if (f.due === "week") {
    where.push(gte(inspections.scheduledFor, start));
    where.push(lt(inspections.scheduledFor, weekEnd));
  }

  if (f.q) {
    const pat = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push(ilike(inspections.notes, pat));
  }

  const rows = await tx
    .select({
      id: inspections.id,
      kind: inspections.kind,
      status: inspections.status,
      scheduledFor: inspections.scheduledFor,
      updatedAt: inspections.updatedAt,
      unitId: inspections.unitId,
      propertyName: properties.name,
      unitLabel: units.label,
    })
    .from(inspections)
    .leftJoin(properties, eq(properties.id, inspections.propertyId))
    .leftJoin(units, eq(units.id, inspections.unitId))
    .where(and(...where))
    .orderBy(desc(inspections.updatedAt))
    .limit(limit);

  const owners = await loadActiveOwners(
    tx,
    orgId,
    "inspection",
    rows.map((r) => r.id),
  );

  return rows.map((r): WorkRow => {
    const urgency = insUrgency(r.status, r.scheduledFor, now);
    return {
      id: r.id,
      ref: `INS-${r.id.slice(0, 6).toUpperCase()}`,
      type: "ins",
      title: `${capitalize(r.kind.replace(/_/g, " "))} inspection`,
      status: r.status,
      priority: null,
      ownerName: owners.get(r.id) ?? null,
      property: r.propertyName,
      unit: r.unitLabel,
      unitId: r.unitId,
      dueAt: r.scheduledFor ? r.scheduledFor.toISOString() : null,
      lastActionAt: r.updatedAt.toISOString(),
      lastActionText: r.status,
      urgency,
      aged: isAged(urgency, r.updatedAt, now),
      legacyHref: `/inspections/${r.id}`,
    };
  });
}

async function queryProjects(
  tx: ScopedDB,
  orgId: string,
  f: WorkListFilters,
  now: Date,
  limit: number,
): Promise<WorkRow[]> {
  const where: SQL[] = [eq(projects.orgId, orgId)];

  if (f.status === "open") {
    where.push(drizzleSql`${projects.status} NOT IN ('closed', 'cancelled')`);
  } else if (f.status === "done") {
    where.push(eq(projects.status, "closed"));
  }

  if (f.q) {
    const pat = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push(
      or(ilike(projects.name, pat), ilike(projects.description, pat))!,
    );
  }

  const rows = await tx
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      kind: projects.kind,
      targetCompletion: projects.targetCompletion,
      updatedAt: projects.updatedAt,
      unitId: projects.unitId,
      propertyName: properties.name,
      unitLabel: units.label,
    })
    .from(projects)
    .leftJoin(properties, eq(properties.id, projects.propertyId))
    .leftJoin(units, eq(units.id, projects.unitId))
    .where(and(...where))
    .orderBy(desc(projects.updatedAt))
    .limit(limit);

  const owners = await loadActiveOwners(
    tx,
    orgId,
    "project",
    rows.map((r) => r.id),
  );

  // Turns become first-class pressure: their urgency derives from move-in date
  // + child-WO state, not the hardcoded "muted" they used to carry.
  const turnInputs = rows
    .filter((r) => r.kind === "unit_turn" && r.status !== "closed")
    .map((r) => ({ id: r.id, targetCompletion: r.targetCompletion }));
  const turnStatuses = await loadTurnStatuses(tx, orgId, turnInputs, now);

  return rows.map((r): WorkRow => {
    const ts = r.kind === "unit_turn" ? turnStatuses.get(r.id) : undefined;
    const urgency: Urgency =
      r.status === "closed" ? "done" : ts ? ts.urgency : "muted";
    const hints = ts ? turnRowHint(ts) : undefined;
    return {
      id: r.id,
      ref: `PRJ-${r.id.slice(0, 6).toUpperCase()}`,
      type: "prj",
      title: r.name,
      status: r.status,
      priority: null,
      ownerName: owners.get(r.id) ?? null,
      property: r.propertyName,
      unit: r.unitLabel,
      unitId: r.unitId,
      dueAt: r.targetCompletion ? r.targetCompletion.toISOString() : null,
      lastActionAt: r.updatedAt.toISOString(),
      lastActionText: r.status,
      urgency,
      aged: isAged(urgency, r.updatedAt, now),
      hints,
      legacyHref: `/projects/${r.id}`,
    };
  });
}

/** Subtitle hint for a turn row: "move-in 9d · 1/6 done · 2 blocked". */
function turnRowHint(ts: TurnComputed): RowHint[] | undefined {
  const parts: string[] = [];
  if (ts.daysToMoveIn != null) {
    parts.push(
      ts.daysToMoveIn >= 0
        ? `move-in ${ts.daysToMoveIn}d`
        : `move-in ${-ts.daysToMoveIn}d ago`,
    );
  }
  parts.push(`${ts.done}/${ts.total} done`);
  if (ts.blocked > 0) parts.push(`${ts.blocked} blocked`);
  if (ts.pendingApprovals > 0) parts.push(`${ts.pendingApprovals} awaiting sign-off`);
  if (parts.length === 0) return undefined;
  return [
    { text: parts.join(" · "), tone: ts.confidence === "off_track" ? "alert" : "note" },
  ];
}

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

function isAged(urgency: Urgency, updatedAt: Date, now: Date): boolean {
  if (urgency === "overdue" || urgency === "today" || urgency === "done") {
    return false;
  }
  return now.getTime() - updatedAt.getTime() > STALE_THRESHOLD_MS;
}

function woUrgency(
  status: string,
  dueAt: Date | null,
  now: Date,
): Urgency {
  if (status === "closed" || status === "cancelled") return "done";
  if (status === "blocked") return "blocked";
  if (dueAt && dueAt < now) return "overdue";
  if (status === "in_progress") return "inflow";
  if (dueAt) {
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    if (dueAt <= todayEnd) return "today";
  }
  return "muted";
}

function insUrgency(
  status: string,
  scheduledFor: Date | null,
  now: Date,
): Urgency {
  if (status === "reviewed" || status === "completed") return "done";
  if (status === "cancelled") return "muted";
  if (scheduledFor && scheduledFor < now && status === "scheduled") {
    return "overdue";
  }
  if (status === "in_progress") return "inflow";
  return "muted";
}

function lastActionForWO(status: string): string | null {
  if (status === "in_progress") return "in progress";
  if (status === "blocked") return "blocked";
  if (status === "scheduled") return "scheduled";
  if (status === "assigned") return "assigned";
  if (status === "new") return "new";
  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
