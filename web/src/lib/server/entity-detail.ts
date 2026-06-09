import "server-only";
import { and, asc, desc, eq, inArray, sql as drizzleSql } from "drizzle-orm";
import { workOrders } from "@db/schema/work-orders";
import { inspections } from "@db/schema/inspections";
import { projects } from "@db/schema/projects";
import { properties } from "@db/schema/properties";
import { units } from "@db/schema/units";
import { auditLog } from "@db/schema/audit-log";
import { taskCosts } from "@db/schema/financials";
import { attachments } from "@db/schema/attachments";
import { comments } from "@db/schema/comments";
import { approvals } from "@db/schema/approvals";
import { users } from "@db/schema/users";
import { assignments } from "@db/schema/assignments";
import { vendorUsers } from "@db/schema/vendor-users";
import { WORK_ORDER_STATUSES, canTransition, type WorkOrderStatus } from "@contracts/state-machines/work-order";
import { withStaffScope, type ScopedDB } from "./db";
import { loadTurnStatuses } from "./turn-status";
import {
  loadUnitHistory,
  loadVendorReliability,
  loadSiblingWork,
  loadTenantContext,
  loadInspectionLineage,
  loadDispatchTimeline,
  type UnitHistory,
  type VendorReliability,
  type SiblingWorkItem,
  type TenantContext,
  type InspectionLineage,
  type DispatchEvent,
} from "./memory";

export interface EntityDetail {
  ref: string;
  type: "wo" | "ins" | "prj" | "unit" | "approval";
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
  /** Comments, oldest first, with actor name resolved. */
  comments: CommentItem[];
  /** Status transitions the operator can perform from the drawer. */
  nextStatuses: string[];
  /** For approval refs, the linked work-order context. */
  linkedWo?: {
    ref: string;
    title: string;
    status: string;
    dueAt: string | null;
  };
  /** For approval refs, the raw amount in cents. */
  amountCents?: string | null;
  /** For approval refs, the original reason key (for re-render). */
  reason?: string;
  /** Pending approvals attached to a WO drawer — cross-entity causality. */
  pendingApprovals?: Array<{
    id: string;
    ref: string;
    reason: string;
    amountCents: string | null;
    createdAt: string;
  }>;
  /** Memory layer — embedded facts about this entity's context. */
  unitHistory?: UnitHistory | null;
  vendorReliability?: VendorReliability | null;
  siblingWork?: SiblingWorkItem[];
  /** Phase B: tenant context (when unit has a tenant). */
  tenantContext?: TenantContext | null;
  /** Phase B: inspection lineage (when WO was spawned from an inspection). */
  inspectionLineage?: InspectionLineage | null;
  /** Phase B: last 6 status transitions, oldest → newest. */
  dispatchTimeline?: DispatchEvent[];
  /** Phase 2: turn outcome — only on unit_turn projects. Answers
   *  "is this turn on track for its move-in date?" */
  turn?: TurnDetail | null;
}

export interface TurnDetail {
  moveInAt: string | null;
  daysToMoveIn: number | null;
  total: number;
  done: number;
  open: number;
  blocked: number;
  overdue: number;
  pendingApprovals: number;
  confidence: "on_track" | "at_risk" | "off_track";
  blockers: Array<{
    ref: string;
    title: string;
    reason: string;
    owner: string | null;
    actorNeeded: "you" | "vendor";
    approvalRef: string | null;
    amountCents: string | null;
  }>;
}

export interface ActivityItem {
  id: string;
  action: string;
  actorType: string;
  /** Resolved actor display name (initials for staff, "system"/"vendor" otherwise). */
  actorName: string | null;
  at: string;
  diff: unknown;
}

export interface CommentItem {
  id: string;
  body: string;
  actorType: string;
  actorName: string | null;
  visibility: "internal" | "external";
  at: string;
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
  const unitMatch = /^UNT-([A-F0-9]{4,12})$/.exec(trimmed);
  const apMatch = /^AP-([A-F0-9]{4,12})$/.exec(trimmed);

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
    if (unitMatch) {
      return loadUnit(tx, ctx.orgId, unitMatch[1]!.toLowerCase());
    }
    if (apMatch) {
      return loadApproval(tx, ctx.orgId, apMatch[1]!.toLowerCase());
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
      propertyId: workOrders.propertyId,
      unitId: workOrders.unitId,
      spawnedFromInspectionId: workOrders.spawnedFromInspectionId,
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

  // Resolve the active assigned vendor (assignee_type='vendor'). Drawer
  // memory needs the vendor's id for the reliability stats; the row's
  // displayed ownerName comes through the queue loader, not here.
  const activeVendor = await loadActiveAssignedVendorId(tx, orgId, r.id);

  const [
    activity,
    costs,
    files,
    commentsList,
    pending,
    unitHistory,
    vendorReliability,
    siblingWork,
    tenantContext,
    inspectionLineage,
    dispatchTimeline,
  ] = await Promise.all([
    loadActivity(tx, orgId, "work_order", r.id),
    loadCosts(tx, orgId, r.id),
    loadFiles(tx, orgId, "work_order", r.id),
    loadComments(tx, orgId, "work_order", r.id),
    loadPendingApprovalsForWo(tx, orgId, r.id),
    r.unitId ? loadUnitHistory(tx, orgId, r.unitId, r.id) : Promise.resolve(null),
    activeVendor
      ? loadVendorReliability(tx, orgId, activeVendor)
      : Promise.resolve(null),
    r.propertyId
      ? loadSiblingWork(tx, orgId, r.propertyId, r.id)
      : Promise.resolve([]),
    r.unitId
      ? loadTenantContext(tx, orgId, r.unitId)
      : Promise.resolve(null),
    r.spawnedFromInspectionId
      ? loadInspectionLineage(tx, orgId, r.spawnedFromInspectionId)
      : Promise.resolve(null),
    loadDispatchTimeline(tx, orgId, r.id),
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
    comments: commentsList,
    nextStatuses: nextWorkOrderStatuses(r.status),
    pendingApprovals: pending,
    unitHistory,
    vendorReliability,
    siblingWork,
    tenantContext,
    inspectionLineage,
    dispatchTimeline,
  };
}

async function loadActiveAssignedVendorId(
  tx: ScopedDB,
  orgId: string,
  woId: string,
): Promise<string | null> {
  // The WO may be assigned either directly to a vendor or via a
  // vendor_user (a specific person at the vendor). Both resolve to
  // the same vendor id for the drawer's VENDOR block.
  const rows = await tx
    .select({
      vendorId: drizzleSql<string>`CASE WHEN ${assignments.assigneeType} = 'vendor' THEN ${assignments.assigneeId} ELSE ${vendorUsers.vendorId} END`,
    })
    .from(assignments)
    .leftJoin(
      vendorUsers,
      and(
        eq(vendorUsers.id, assignments.assigneeId),
        eq(assignments.assigneeType, "vendor_user"),
      ),
    )
    .where(
      and(
        eq(assignments.orgId, orgId),
        eq(assignments.targetType, "work_order"),
        eq(assignments.targetId, woId),
        drizzleSql`${assignments.assigneeType} IN ('vendor', 'vendor_user')`,
      ),
    )
    .orderBy(desc(assignments.assignedAt))
    .limit(1);
  return rows[0]?.vendorId ?? null;
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

  const [activity, files, commentsList] = await Promise.all([
    loadActivity(tx, orgId, "inspection", r.id),
    loadFiles(tx, orgId, "inspection", r.id),
    loadComments(tx, orgId, "inspection", r.id),
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
    comments: commentsList,
    nextStatuses: [],
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

  const [activity, files, commentsList] = await Promise.all([
    loadActivity(tx, orgId, "project", r.id),
    loadFiles(tx, orgId, "project", r.id),
    loadComments(tx, orgId, "project", r.id),
  ]);

  // For a unit turn, compute the outcome: is it on track for move-in?
  let turn: EntityDetail["turn"] = null;
  if (r.kind === "unit_turn") {
    const statuses = await loadTurnStatuses(tx, orgId, [
      { id: r.id, targetCompletion: r.targetCompletion },
    ]);
    const tc = statuses.get(r.id);
    if (tc) {
      turn = {
        moveInAt: r.targetCompletion ? r.targetCompletion.toISOString() : null,
        daysToMoveIn: tc.daysToMoveIn,
        total: tc.total,
        done: tc.done,
        open: tc.open,
        blocked: tc.blocked,
        overdue: tc.overdue,
        pendingApprovals: tc.pendingApprovals,
        confidence: tc.confidence,
        blockers: tc.blockers,
      };
    }
  }

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
    comments: commentsList,
    nextStatuses: [],
    turn,
  };
}

/**
 * Unit drawer — the spine. "Everything on this unit": its open work, its
 * recurrence history, and its tenant. Reuses the existing memory loaders so
 * the drawer renders the same UnitHistory / Tenant / sibling-work blocks the
 * WO drawer already knows how to show. Derived entirely from existing FKs —
 * no unit status column, no schema change.
 */
async function loadUnit(
  tx: ScopedDB,
  orgId: string,
  idPrefix: string,
): Promise<EntityDetail | null> {
  const rows = await tx
    .select({
      id: units.id,
      label: units.label,
      createdAt: units.createdAt,
      updatedAt: units.updatedAt,
      propertyName: properties.name,
    })
    .from(units)
    .leftJoin(properties, eq(properties.id, units.propertyId))
    .where(
      and(
        eq(units.orgId, orgId),
        drizzleSql`left(${units.id}::text, ${idPrefix.length}) = ${idPrefix}`,
      ),
    )
    .limit(1);
  const r = rows[0];
  if (!r) return null;

  const [activity, files, commentsList, unitHistory, tenantContext, openWork] =
    await Promise.all([
      loadActivity(tx, orgId, "unit", r.id),
      loadFiles(tx, orgId, "unit", r.id),
      loadComments(tx, orgId, "unit", r.id),
      // No focal WO to exclude — pass the nil uuid so nothing is filtered out.
      loadUnitHistory(tx, orgId, r.id, NIL_UUID),
      loadTenantContext(tx, orgId, r.id),
      loadOpenWorkOnUnit(tx, orgId, r.id),
    ]);

  return {
    ref: `UNT-${r.id.slice(0, 6).toUpperCase()}`,
    type: "unit",
    id: r.id,
    title: [r.propertyName, r.label].filter(Boolean).join(" "),
    description: null,
    // Occupancy is a plain read of tenant presence — not a readiness model
    // (that lands in Phase 1). Renders via the WO status-label fallback.
    status: tenantContext ? "occupied" : "vacant",
    priority: null,
    property: r.propertyName ? { name: r.propertyName } : null,
    unit: { label: r.label },
    dueAt: null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    legacyHref: "/admin/properties",
    activity,
    costs: [],
    files,
    comments: commentsList,
    nextStatuses: [],
    unitHistory,
    tenantContext,
    siblingWork: openWork,
  };
}

/** Nil uuid — a valid uuid that never matches a real row, used to satisfy
 *  loadUnitHistory's "exclude focal WO" param when there is no focal WO. */
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * Open WOs sitting on a unit — the unit's live work, rendered in the drawer's
 * "Also here" block. Active-first sort mirrors loadSiblingWork.
 */
async function loadOpenWorkOnUnit(
  tx: ScopedDB,
  orgId: string,
  unitId: string,
): Promise<NonNullable<EntityDetail["siblingWork"]>> {
  const rows = await tx
    .select({
      number: workOrders.number,
      title: workOrders.title,
      status: workOrders.status,
      dueAt: workOrders.dueAt,
    })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.orgId, orgId),
        eq(workOrders.unitId, unitId),
        drizzleSql`${workOrders.status} NOT IN ('closed', 'cancelled', 'verified', 'resolved')`,
      ),
    )
    .orderBy(
      drizzleSql`case ${workOrders.status}
        when 'blocked' then 0
        when 'in_progress' then 1
        when 'assigned' then 2
        when 'scheduled' then 3
        when 'triaged' then 4
        else 5 end`,
      asc(workOrders.dueAt),
      desc(workOrders.updatedAt),
    )
    .limit(8);
  return rows.map((r) => ({
    ref: `WO-${r.number}`,
    title: r.title,
    status: r.status,
    dueAt: r.dueAt ? r.dueAt.toISOString() : null,
    unitLabel: null,
  }));
}

async function loadApproval(
  tx: ScopedDB,
  orgId: string,
  idPrefix: string,
): Promise<EntityDetail | null> {
  const rows = await tx
    .select({
      id: approvals.id,
      reason: approvals.reason,
      amount: approvals.amountCents,
      notes: approvals.notes,
      status: approvals.status,
      createdAt: approvals.createdAt,
      updatedAt: approvals.updatedAt,
      targetType: approvals.targetType,
      targetId: approvals.targetId,
      woNumber: workOrders.number,
      woTitle: workOrders.title,
      woStatus: workOrders.status,
      woDueAt: workOrders.dueAt,
    })
    .from(approvals)
    .leftJoin(workOrders, eq(workOrders.id, approvals.targetId))
    .where(
      and(
        eq(approvals.orgId, orgId),
        drizzleSql`left(${approvals.id}::text, ${idPrefix.length}) = ${idPrefix}`,
      ),
    )
    .limit(1);
  const r = rows[0];
  if (!r) return null;

  // Comments threaded against the underlying WO — that's where operators
  // actually discuss the decision.
  const commentsList =
    r.targetType === "work_order"
      ? await loadComments(tx, orgId, "work_order", r.targetId)
      : [];

  return {
    ref: `AP-${r.id.slice(0, 6).toUpperCase()}`,
    type: "approval",
    id: r.id,
    title: r.notes ?? r.reason,
    description: r.notes,
    status: r.status,
    priority: null,
    property: null,
    unit: null,
    dueAt: null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    legacyHref: "/money?tab=approvals",
    activity: [],
    costs: [],
    files: [],
    comments: commentsList,
    nextStatuses: [],
    reason: r.reason,
    amountCents: r.amount,
    linkedWo: r.woNumber
      ? {
          ref: `WO-${r.woNumber}`,
          title: r.woTitle ?? "",
          status: r.woStatus ?? "",
          dueAt: r.woDueAt ? r.woDueAt.toISOString() : null,
        }
      : undefined,
  };
}

function nextWorkOrderStatuses(current: string): string[] {
  const cur = current as WorkOrderStatus;
  return WORK_ORDER_STATUSES.filter((s) => canTransition(cur, s));
}

async function loadPendingApprovalsForWo(
  tx: ScopedDB,
  orgId: string,
  woId: string,
): Promise<NonNullable<EntityDetail["pendingApprovals"]>> {
  const rows = await tx
    .select({
      id: approvals.id,
      reason: approvals.reason,
      amountCents: approvals.amountCents,
      createdAt: approvals.createdAt,
    })
    .from(approvals)
    .where(
      and(
        eq(approvals.orgId, orgId),
        eq(approvals.targetType, "work_order"),
        eq(approvals.targetId, woId),
        eq(approvals.status, "pending"),
      ),
    )
    .orderBy(desc(approvals.createdAt));
  return rows.map((r) => ({
    id: r.id,
    ref: `AP-${r.id.slice(0, 6).toUpperCase()}`,
    reason: r.reason,
    amountCents: r.amountCents,
    createdAt: r.createdAt.toISOString(),
  }));
}

async function loadComments(
  tx: ScopedDB,
  orgId: string,
  targetType: "work_order" | "inspection" | "project" | "unit",
  targetId: string,
): Promise<CommentItem[]> {
  const rows = await tx
    .select({
      id: comments.id,
      body: comments.body,
      actorType: comments.actorType,
      actorUserId: comments.actorUserId,
      visibility: comments.visibility,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(
      and(
        eq(comments.orgId, orgId),
        eq(comments.targetType, targetType),
        eq(comments.targetId, targetId),
      ),
    )
    .orderBy(asc(comments.createdAt))
    .limit(50);

  const userIds = rows
    .map((r) => r.actorUserId)
    .filter((v): v is string => !!v);
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const us = await tx
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.orgId, orgId), inArray(users.id, userIds)));
    for (const u of us) {
      names.set(u.id, u.name ?? u.email.split("@")[0] ?? "user");
    }
  }

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    actorType: r.actorType,
    actorName:
      r.actorType === "user"
        ? r.actorUserId
          ? names.get(r.actorUserId) ?? null
          : null
        : r.actorType, // "vendor" / "tenant"
    visibility: r.visibility as "internal" | "external",
    at: r.createdAt.toISOString(),
  }));
}

async function loadActivity(
  tx: ScopedDB,
  orgId: string,
  targetType: "work_order" | "inspection" | "project" | "unit",
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

  const userIds = rows
    .map((r) => r.actorUserId)
    .filter((v): v is string => !!v);
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const us = await tx
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.orgId, orgId), inArray(users.id, userIds)));
    for (const u of us) {
      names.set(u.id, u.name ?? u.email.split("@")[0] ?? "user");
    }
  }

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorType: r.actorType,
    actorName:
      r.actorType === "user" && r.actorUserId
        ? names.get(r.actorUserId) ?? null
        : null,
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
  targetType: "work_order" | "inspection" | "project" | "unit",
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
