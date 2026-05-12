import "server-only";
import { and, desc, eq, sql as drizzleSql } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { inspections } from "@db/schema/inspections";
import { projects } from "@db/schema/projects";
import { properties } from "@db/schema/properties";
import { units } from "@db/schema/units";
import { auditLog } from "@db/schema/audit-log";
import { taskCosts } from "@db/schema/financials";
import { attachments } from "@db/schema/attachments";
import { withStaffScope, type ScopedDB } from "./db";

export interface EntityDetail {
  ref: string;
  type: "wo" | "ins" | "prj";
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  property: { name: string } | null;
  unit: { label: string } | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  legacyHref: string;
  activity: ActivityItem[];
  costs: CostItem[];
  files: FileItem[];
}

export interface ActivityItem {
  id: string;
  action: string;
  actorType: string;
  at: string;
  diff: unknown;
}

export interface CostItem {
  id: string;
  kind: string;
  amountCents: string;
  description: string | null;
  at: string;
}

export interface FileItem {
  id: string;
  filename: string | null;
  kind: string;
  sizeBytes: number | null;
  at: string;
}

/**
 * Look up an entity by its short ref (`WO-1043`, `INS-ABC123`, `PRJ-ABC123`).
 *
 * Returns null when the ref doesn't match or the entity isn't visible to the
 * caller (RLS-scoped via withStaffScope).
 */
export async function loadEntityDetail(
  ref: string,
): Promise<EntityDetail | null> {
  const trimmed = ref.trim().toUpperCase();
  const woMatch = /^WO-(\d+)$/.exec(trimmed);
  const insMatch = /^INS-([A-F0-9]{4,12})$/.exec(trimmed);
  const prjMatch = /^PRJ-([A-F0-9]{4,12})$/.exec(trimmed);

  return withStaffScope(async (tx, ctx) => {
    if (woMatch) {
      return loadWO(tx, ctx.orgId, Number(woMatch[1]));
    }
    if (insMatch) {
      return loadIns(tx, ctx.orgId, insMatch[1]!.toLowerCase());
    }
    if (prjMatch) {
      return loadPrj(tx, ctx.orgId, prjMatch[1]!.toLowerCase());
    }
    return null;
  });
}

async function loadWO(
  tx: ScopedDB,
  orgId: string,
  number: number,
): Promise<EntityDetail | null> {
  const rows = await tx
    .select({
      id: workOrders.id,
      number: workOrders.number,
      title: workOrders.title,
      description: workOrders.description,
      status: workOrders.status,
      priority: workOrders.priority,
      dueAt: workOrders.dueAt,
      createdAt: workOrders.createdAt,
      updatedAt: workOrders.updatedAt,
      propertyName: properties.name,
      unitLabel: units.label,
    })
    .from(workOrders)
    .leftJoin(properties, eq(properties.id, workOrders.propertyId))
    .leftJoin(units, eq(units.id, workOrders.unitId))
    .where(and(eq(workOrders.orgId, orgId), eq(workOrders.number, number)))
    .limit(1);
  const r = rows[0];
  if (!r) return null;

  const [activity, costs, files] = await Promise.all([
    loadActivity(tx, orgId, "work_order", r.id),
    loadCosts(tx, orgId, r.id),
    loadFiles(tx, orgId, "work_order", r.id),
  ]);

  return {
    ref: `WO-${r.number}`,
    type: "wo",
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    property: r.propertyName ? { name: r.propertyName } : null,
    unit: r.unitLabel ? { label: r.unitLabel } : null,
    dueAt: r.dueAt ? r.dueAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    legacyHref: `/work-orders/${r.id}`,
    activity,
    costs,
    files,
  };
}

async function loadIns(
  tx: ScopedDB,
  orgId: string,
  idPrefix: string,
): Promise<EntityDetail | null> {
  const rows = await tx
    .select({
      id: inspections.id,
      kind: inspections.kind,
      status: inspections.status,
      notes: inspections.notes,
      scheduledFor: inspections.scheduledFor,
      createdAt: inspections.createdAt,
      updatedAt: inspections.updatedAt,
      propertyName: properties.name,
      unitLabel: units.label,
    })
    .from(inspections)
    .leftJoin(properties, eq(properties.id, inspections.propertyId))
    .leftJoin(units, eq(units.id, inspections.unitId))
    .where(
      and(
        eq(inspections.orgId, orgId),
        drizzleSql`left(${inspections.id}::text, ${idPrefix.length}) = ${idPrefix}`,
      ),
    )
    .limit(1);
  const r = rows[0];
  if (!r) return null;

  const [activity, files] = await Promise.all([
    loadActivity(tx, orgId, "inspection", r.id),
    loadFiles(tx, orgId, "inspection", r.id),
  ]);

  return {
    ref: `INS-${r.id.slice(0, 6).toUpperCase()}`,
    type: "ins",
    id: r.id,
    title: `${capitalize(r.kind.replace(/_/g, " "))} inspection`,
    description: r.notes,
    status: r.status,
    priority: null,
    property: r.propertyName ? { name: r.propertyName } : null,
    unit: r.unitLabel ? { label: r.unitLabel } : null,
    dueAt: r.scheduledFor ? r.scheduledFor.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    legacyHref: `/inspections/${r.id}`,
    activity,
    costs: [],
    files,
  };
}

async function loadPrj(
  tx: ScopedDB,
  orgId: string,
  idPrefix: string,
): Promise<EntityDetail | null> {
  const rows = await tx
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      status: projects.status,
      kind: projects.kind,
      targetCompletion: projects.targetCompletion,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      propertyName: properties.name,
      unitLabel: units.label,
    })
    .from(projects)
    .leftJoin(properties, eq(properties.id, projects.propertyId))
    .leftJoin(units, eq(units.id, projects.unitId))
    .where(
      and(
        eq(projects.orgId, orgId),
        drizzleSql`left(${projects.id}::text, ${idPrefix.length}) = ${idPrefix}`,
      ),
    )
    .limit(1);
  const r = rows[0];
  if (!r) return null;

  const [activity, files] = await Promise.all([
    loadActivity(tx, orgId, "project", r.id),
    loadFiles(tx, orgId, "project", r.id),
  ]);

  return {
    ref: `PRJ-${r.id.slice(0, 6).toUpperCase()}`,
    type: "prj",
    id: r.id,
    title: r.name,
    description: r.description,
    status: r.status,
    priority: null,
    property: r.propertyName ? { name: r.propertyName } : null,
    unit: r.unitLabel ? { label: r.unitLabel } : null,
    dueAt: r.targetCompletion ? r.targetCompletion.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    legacyHref: `/projects/${r.id}`,
    activity,
    costs: [],
    files,
  };
}

async function loadActivity(
  tx: ScopedDB,
  orgId: string,
  targetType: "work_order" | "inspection" | "project",
  targetId: string,
): Promise<ActivityItem[]> {
  const rows = await tx
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.orgId, orgId),
        eq(auditLog.targetType, targetType),
        eq(auditLog.targetId, targetId),
      ),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(25);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorType: r.actorType,
    at: r.createdAt.toISOString(),
    diff: r.diff,
  }));
}

async function loadCosts(
  tx: ScopedDB,
  orgId: string,
  workOrderId: string,
): Promise<CostItem[]> {
  const rows = await tx
    .select()
    .from(taskCosts)
    .where(and(eq(taskCosts.orgId, orgId), eq(taskCosts.workOrderId, workOrderId)))
    .orderBy(desc(taskCosts.createdAt))
    .limit(25);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    amountCents: String(r.amountCents),
    description: r.description,
    at: r.createdAt.toISOString(),
  }));
}

async function loadFiles(
  tx: ScopedDB,
  orgId: string,
  targetType: "work_order" | "inspection" | "project",
  targetId: string,
): Promise<FileItem[]> {
  const rows = await tx
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.orgId, orgId),
        eq(attachments.targetType, targetType),
        eq(attachments.targetId, targetId),
      ),
    )
    .orderBy(desc(attachments.createdAt))
    .limit(25);
  return rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    kind: r.kind,
    sizeBytes: r.sizeBytes,
    at: r.createdAt.toISOString(),
  }));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
