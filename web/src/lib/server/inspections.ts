import "server-only";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { inspections, inspectionFindings } from "@db/schema/inspections";
import { workOrders } from "@db/schema/work-orders";
import {
  INSPECTION_KINDS,
  INSPECTION_STATUSES,
  canTransition as canInspectionTransition,
  type InspectionStatus,
} from "@contracts/state-machines/inspection";
import {
  FINDING_SEVERITIES,
  shouldSpawnWorkOrder,
  type FindingSeverity,
} from "@contracts/finding-severity";
import { withStaffScope, type ScopedDB } from "./db";
import { writeAudit } from "./audit";
import { nextWorkOrderNumber } from "./sequence";
import { ensureUserRow } from "./sync-user";

export const createInspectionInput = z.object({
  kind: z.enum(INSPECTION_KINDS).default("ad_hoc"),
  propertyId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  scheduledFor: z.coerce.date().optional(),
  notes: z.string().max(10_000).optional(),
});

export async function createInspection(input: z.input<typeof createInspectionInput>) {
  const parsed = createInspectionInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const inserted = await tx
      .insert(inspections)
      .values({
        orgId: ctx.orgId,
        kind: parsed.kind,
        status: "scheduled",
        propertyId: parsed.propertyId ?? null,
        unitId: parsed.unitId ?? null,
        inspectorUserId: userId,
        notes: parsed.notes ?? null,
        scheduledFor: parsed.scheduledFor ?? null,
      })
      .returning();
    const row = inserted[0]!;
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "inspection",
      targetId: row.id,
      action: "created",
      actorUserId: userId,
      diff: { kind: parsed.kind, propertyId: parsed.propertyId, unitId: parsed.unitId },
    });
    return row;
  });
}

export async function listInspections(filter?: { status?: InspectionStatus }) {
  return withStaffScope(async (tx, ctx) => {
    const conds = [eq(inspections.orgId, ctx.orgId)];
    if (filter?.status) conds.push(eq(inspections.status, filter.status));
    return tx
      .select()
      .from(inspections)
      .where(and(...conds))
      .orderBy(desc(inspections.createdAt))
      .limit(200);
  });
}

export async function getInspection(id: string) {
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select()
      .from(inspections)
      .where(and(eq(inspections.orgId, ctx.orgId), eq(inspections.id, id)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function listFindings(inspectionId: string) {
  return withStaffScope(async (tx, ctx) =>
    tx
      .select()
      .from(inspectionFindings)
      .where(
        and(
          eq(inspectionFindings.orgId, ctx.orgId),
          eq(inspectionFindings.inspectionId, inspectionId),
        ),
      )
      .orderBy(asc(inspectionFindings.createdAt)),
  );
}

export const addFindingInput = z.object({
  inspectionId: z.string().uuid(),
  area: z.string().max(80).optional(),
  description: z.string().min(1).max(10_000),
  severity: z.enum(FINDING_SEVERITIES).default("observation"),
  pass: z.boolean().default(true),
});

export async function addFinding(input: z.input<typeof addFindingInput>) {
  const parsed = addFindingInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    // Confirm inspection belongs to this org and isn't already reviewed.
    const ins = await getInspectionRow(tx, ctx.orgId, parsed.inspectionId);
    if (!ins) throw new Error("inspection_not_found");
    if (ins.status === "reviewed" || ins.status === "completed") {
      throw new Error("inspection_locked");
    }
    if (ins.status === "scheduled") {
      // First finding implicitly transitions scheduled → in_progress.
      await tx
        .update(inspections)
        .set({
          status: "in_progress",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(inspections.id, ins.id));
    }
    const inserted = await tx
      .insert(inspectionFindings)
      .values({
        orgId: ctx.orgId,
        inspectionId: parsed.inspectionId,
        area: parsed.area ?? null,
        description: parsed.description,
        severity: parsed.severity,
        pass: parsed.pass,
      })
      .returning();
    return inserted[0]!;
  });
}

export const updateFindingInput = z.object({
  id: z.string().uuid(),
  area: z.string().max(80).optional(),
  description: z.string().max(10_000).optional(),
  severity: z.enum(FINDING_SEVERITIES).optional(),
  pass: z.boolean().optional(),
});

export async function updateFinding(input: z.input<typeof updateFindingInput>) {
  const parsed = updateFindingInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const updated = await tx
      .update(inspectionFindings)
      .set({
        area: parsed.area,
        description: parsed.description,
        severity: parsed.severity,
        pass: parsed.pass,
        updatedAt: new Date(),
      })
      .where(
        and(eq(inspectionFindings.orgId, ctx.orgId), eq(inspectionFindings.id, parsed.id)),
      )
      .returning();
    return updated[0] ?? null;
  });
}

export async function removeFinding(id: string) {
  return withStaffScope(async (tx, ctx) => {
    const r = await tx
      .delete(inspectionFindings)
      .where(and(eq(inspectionFindings.orgId, ctx.orgId), eq(inspectionFindings.id, id)))
      .returning({ id: inspectionFindings.id });
    return r.length > 0;
  });
}

/**
 * Atomically transition an inspection scheduled/in_progress → completed
 * AND spawn one work_order for every actionable/critical finding that
 * failed (`pass=false`). All in one transaction; if anything fails the
 * whole thing rolls back.
 *
 * Idempotent: if a finding already has spawned_work_order_id set, it is
 * skipped.
 */
export async function completeInspection(inspectionId: string): Promise<{
  inspectionId: string;
  spawnedWorkOrderIds: string[];
}> {
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const ins = await getInspectionRow(tx, ctx.orgId, inspectionId);
    if (!ins) throw new Error("inspection_not_found");
    if (ins.status === "completed" || ins.status === "reviewed") {
      // Idempotent — return what was already spawned.
      const fs = await tx
        .select({ id: inspectionFindings.spawnedWorkOrderId })
        .from(inspectionFindings)
        .where(eq(inspectionFindings.inspectionId, inspectionId));
      return {
        inspectionId,
        spawnedWorkOrderIds: fs.map((f) => f.id).filter((x): x is string => !!x),
      };
    }
    if (!canInspectionTransition(ins.status as InspectionStatus, "completed")) {
      throw new Error(`invalid_transition:${ins.status}->completed`);
    }

    const findings = await tx
      .select()
      .from(inspectionFindings)
      .where(eq(inspectionFindings.inspectionId, inspectionId));

    const spawnable = findings.filter(
      (f) =>
        !f.spawnedWorkOrderId &&
        shouldSpawnWorkOrder({
          severity: f.severity as FindingSeverity,
          pass: f.pass,
        }),
    );

    const spawnedIds: string[] = [];
    for (const f of spawnable) {
      const number = await nextWorkOrderNumber(tx, ctx.orgId);
      const wo = await tx
        .insert(workOrders)
        .values({
          orgId: ctx.orgId,
          number,
          title: `[Insp] ${f.description.slice(0, 160)}`,
          description: `Spawned from inspection ${ins.id}, finding "${f.description}". Severity: ${f.severity}.`,
          kind: "work_order",
          status: "new",
          priority: f.severity === "critical" ? "urgent" : "normal",
          propertyId: ins.propertyId,
          unitId: ins.unitId,
          spawnedFromInspectionId: ins.id,
          spawnedFromFindingId: f.id,
          createdByUserId: userId,
          createdByActorType: "user",
        })
        .returning({ id: workOrders.id });
      const woId = wo[0]!.id;
      await tx
        .update(inspectionFindings)
        .set({ spawnedWorkOrderId: woId, updatedAt: new Date() })
        .where(eq(inspectionFindings.id, f.id));
      await writeAudit(tx, {
        orgId: ctx.orgId,
        targetType: "work_order",
        targetId: woId,
        action: "created",
        actorUserId: userId,
        diff: {
          spawnedFromInspectionId: ins.id,
          spawnedFromFindingId: f.id,
          severity: f.severity,
        },
      });
      spawnedIds.push(woId);
    }

    // Transition inspection → completed
    await tx
      .update(inspections)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(inspections.id, ins.id));

    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "inspection",
      targetId: ins.id,
      action: "completed",
      actorUserId: userId,
      diff: {
        spawnedCount: spawnedIds.length,
        totalFindings: findings.length,
      },
    });

    return { inspectionId, spawnedWorkOrderIds: spawnedIds };
  });
}

export async function reviewInspection(inspectionId: string) {
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const ins = await getInspectionRow(tx, ctx.orgId, inspectionId);
    if (!ins) throw new Error("inspection_not_found");
    if (!canInspectionTransition(ins.status as InspectionStatus, "reviewed")) {
      throw new Error(`invalid_transition:${ins.status}->reviewed`);
    }
    await tx
      .update(inspections)
      .set({ status: "reviewed", reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(inspections.id, ins.id));
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "inspection",
      targetId: ins.id,
      action: "reviewed",
      actorUserId: userId,
    });
  });
}

/** scheduled → in_progress (idempotent). Stamps startedAt on first entry. */
export async function startInspection(inspectionId: string) {
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const ins = await getInspectionRow(tx, ctx.orgId, inspectionId);
    if (!ins) throw new Error("inspection_not_found");
    if (ins.status === "in_progress") return ins;
    if (!canInspectionTransition(ins.status as InspectionStatus, "in_progress")) {
      throw new Error(`invalid_transition:${ins.status}->in_progress`);
    }
    await tx
      .update(inspections)
      .set({ status: "in_progress", startedAt: ins.startedAt ?? new Date(), updatedAt: new Date() })
      .where(eq(inspections.id, ins.id));
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "inspection",
      targetId: ins.id,
      action: "status_changed",
      actorUserId: userId,
      diff: { from: ins.status, to: "in_progress" },
    });
    return ins;
  });
}

/** Any non-terminal → cancelled (idempotent). */
export async function cancelInspection(inspectionId: string) {
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const ins = await getInspectionRow(tx, ctx.orgId, inspectionId);
    if (!ins) throw new Error("inspection_not_found");
    if (ins.status === "cancelled") return ins;
    if (!canInspectionTransition(ins.status as InspectionStatus, "cancelled")) {
      throw new Error(`invalid_transition:${ins.status}->cancelled`);
    }
    await tx
      .update(inspections)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(inspections.id, ins.id));
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "inspection",
      targetId: ins.id,
      action: "cancelled",
      actorUserId: userId,
    });
    return ins;
  });
}

/**
 * Board move dispatcher — routes a status change to the right handler so side
 * effects fire correctly: `completed` runs the WO-spawning completeInspection;
 * `reviewed` runs reviewInspection; `in_progress`/`cancelled` are simple guarded
 * transitions. Returns the count of work orders spawned (only non-zero when a
 * card is dropped into Completed).
 */
export async function moveInspection(
  inspectionId: string,
  to: InspectionStatus,
): Promise<{ spawned: number }> {
  switch (to) {
    case "in_progress":
      await startInspection(inspectionId);
      return { spawned: 0 };
    case "completed": {
      const r = await completeInspection(inspectionId);
      return { spawned: r.spawnedWorkOrderIds.length };
    }
    case "reviewed":
      await reviewInspection(inspectionId);
      return { spawned: 0 };
    case "cancelled":
      await cancelInspection(inspectionId);
      return { spawned: 0 };
    default:
      throw new Error(`unsupported_transition:${to}`);
  }
}

async function getInspectionRow(tx: ScopedDB, orgId: string, id: string) {
  const rows = await tx
    .select()
    .from(inspections)
    .where(and(eq(inspections.orgId, orgId), eq(inspections.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSpawnedWorkOrders(inspectionId: string) {
  return withStaffScope(async (tx, ctx) =>
    tx
      .select()
      .from(workOrders)
      .where(
        and(
          eq(workOrders.orgId, ctx.orgId),
          eq(workOrders.spawnedFromInspectionId, inspectionId),
        ),
      )
      .orderBy(asc(workOrders.createdAt)),
  );
}

// Re-export the status enum constants alongside other imports use.
export { INSPECTION_STATUSES };
