import "server-only";
import { and, desc, eq, gte, ilike, lt, or, sql as drizzleSql, type SQL } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { inspections } from "@db/schema/inspections";
import { projects } from "@db/schema/projects";
import { properties } from "@db/schema/properties";
import { units } from "@db/schema/units";
import { withStaffScope, type ScopedDB } from "./db";
import { loadActiveOwners } from "./owners";
import type { Urgency } from "../../components/operator/urgency-dot";

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

export interface WorkListFilters {
  type?: WorkType;
  status?: StatusFilter;
  due?: DueFilter;
  q?: string;
  limit?: number;
}

export interface WorkRow {
  ref: string;
  type: "wo" | "ins" | "prj";
  title: string;
  status: string;
  priority: "low" | "normal" | "high" | "urgent" | null;
  ownerName: string | null;
  property: string | null;
  unit: string | null;
  dueAt: string | null;
  lastActionAt: string;
  lastActionText: string | null;
  urgency: Urgency;
  /** Open + untouched for 7d+. See queue.ts for definition. */
  aged: boolean;
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
    const rows = [...woRows, ...insRows, ...prjRows].sort((a, b) => {
      if (a.urgency !== b.urgency) {
        return URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
      }
      return b.lastActionAt.localeCompare(a.lastActionAt);
    });

    return { rows: rows.slice(0, limit), total: rows.length };
  });
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

  const { start, end, weekEnd } = todayBounds(now);
  if (f.due === "overdue") {
    where.push(lt(workOrders.dueAt, now));
    where.push(drizzleSql`${workOrders.status} NOT IN ('closed', 'cancelled')`);
  } else if (f.due === "today") {
    where.push(gte(workOrders.dueAt, start));
    where.push(lt(workOrders.dueAt, end));
  } else if (f.due === "week") {
    where.push(gte(workOrders.dueAt, start));
    where.push(lt(workOrders.dueAt, weekEnd));
  } else if (f.due === "later") {
    where.push(gte(workOrders.dueAt, weekEnd));
  } else if (f.due === "none") {
    where.push(drizzleSql`${workOrders.dueAt} IS NULL`);
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
      updatedAt: workOrders.updatedAt,
      propertyName: properties.name,
      unitLabel: units.label,
    })
    .from(workOrders)
    .leftJoin(properties, eq(properties.id, workOrders.propertyId))
    .leftJoin(units, eq(units.id, workOrders.unitId))
    .where(and(...where))
    .orderBy(desc(workOrders.updatedAt))
    .limit(limit);

  const owners = await loadActiveOwners(
    tx,
    orgId,
    "work_order",
    rows.map((r) => r.id),
  );

  return rows.map((r): WorkRow => {
    const urgency = woUrgency(r.status, r.dueAt, now);
    return {
      ref: `WO-${r.number}`,
      type: "wo",
      title: r.title,
      status: r.status,
      priority: r.priority,
      ownerName: owners.get(r.id) ?? null,
      property: r.propertyName,
      unit: r.unitLabel,
      dueAt: r.dueAt ? r.dueAt.toISOString() : null,
      lastActionAt: r.updatedAt.toISOString(),
      lastActionText: lastActionForWO(r.status),
      urgency,
      aged: isAged(urgency, r.updatedAt, now),
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
      ref: `INS-${r.id.slice(0, 6).toUpperCase()}`,
      type: "ins",
      title: `${capitalize(r.kind.replace(/_/g, " "))} inspection`,
      status: r.status,
      priority: null,
      ownerName: owners.get(r.id) ?? null,
      property: r.propertyName,
      unit: r.unitLabel,
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
      targetCompletion: projects.targetCompletion,
      updatedAt: projects.updatedAt,
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

  return rows.map((r): WorkRow => {
    const urgency: Urgency = r.status === "closed" ? "done" : "muted";
    return {
      ref: `PRJ-${r.id.slice(0, 6).toUpperCase()}`,
      type: "prj",
      title: r.name,
      status: r.status,
      priority: null,
      ownerName: owners.get(r.id) ?? null,
      property: r.propertyName,
      unit: r.unitLabel,
      dueAt: r.targetCompletion ? r.targetCompletion.toISOString() : null,
      lastActionAt: r.updatedAt.toISOString(),
      lastActionText: r.status,
      urgency,
      aged: isAged(urgency, r.updatedAt, now),
      legacyHref: `/projects/${r.id}`,
    };
  });
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
