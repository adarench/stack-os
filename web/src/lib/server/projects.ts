import "server-only";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { projects } from "@db/schema/projects";
import { workOrders } from "@db/schema/work-orders";
import {
  PROJECT_KINDS,
  PROJECT_STATUSES,
  canTransition as canProjectTransition,
  type ProjectStatus,
} from "@contracts/state-machines/project";
import { withStaffScope } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";

export const createProjectInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(10_000).optional(),
  kind: z.enum(PROJECT_KINDS).default("general"),
  propertyId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  budgetCents: z.number().int().min(0).optional(),
  targetCompletion: z.coerce.date().optional(),
  parentProjectId: z.string().uuid().optional(),
});

export async function createProject(input: z.input<typeof createProjectInput>) {
  const parsed = createProjectInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const inserted = await tx
      .insert(projects)
      .values({
        orgId: ctx.orgId,
        name: parsed.name,
        description: parsed.description ?? null,
        kind: parsed.kind,
        status: "planning",
        propertyId: parsed.propertyId ?? null,
        unitId: parsed.unitId ?? null,
        budgetCents: parsed.budgetCents != null ? String(parsed.budgetCents) : null,
        targetCompletion: parsed.targetCompletion ?? null,
        parentProjectId: parsed.parentProjectId ?? null,
        createdByUserId: userId,
      })
      .returning();
    const row = inserted[0]!;
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "project",
      targetId: row.id,
      action: "created",
      actorUserId: userId,
      diff: { name: parsed.name, kind: parsed.kind },
    });
    return row;
  });
}

export async function listProjects(filter?: { status?: ProjectStatus }) {
  return withStaffScope(async (tx, ctx) => {
    const conds = [eq(projects.orgId, ctx.orgId)];
    if (filter?.status) conds.push(eq(projects.status, filter.status));
    return tx
      .select()
      .from(projects)
      .where(and(...conds))
      .orderBy(desc(projects.createdAt))
      .limit(200);
  });
}

export async function getProject(id: string) {
  return withStaffScope(async (tx, ctx) => {
    const rows = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.orgId, ctx.orgId), eq(projects.id, id)))
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function listProjectWorkOrders(projectId: string) {
  return withStaffScope(async (tx, ctx) =>
    tx
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.orgId, ctx.orgId), eq(workOrders.projectId, projectId)))
      .orderBy(asc(workOrders.createdAt)),
  );
}

export async function updateProjectStatus(id: string, to: ProjectStatus) {
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const cur = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.orgId, ctx.orgId), eq(projects.id, id)))
      .limit(1);
    const current = cur[0];
    if (!current) throw new Error("project_not_found");
    if (current.status === to) return current;
    if (!canProjectTransition(current.status as ProjectStatus, to)) {
      throw new Error(`invalid_transition:${current.status}->${to}`);
    }
    const patch: Partial<typeof projects.$inferInsert> = {
      status: to,
      updatedAt: new Date(),
    };
    if (to === "closed") patch.closedAt = new Date();
    const updated = await tx
      .update(projects)
      .set(patch)
      .where(eq(projects.id, id))
      .returning();
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "project",
      targetId: id,
      action: "status_changed",
      actorUserId: userId,
      diff: { from: { status: current.status }, to: { status: to } },
    });
    return updated[0]!;
  });
}

export async function attachWorkOrderToProject(args: {
  workOrderId: string;
  projectId: string | null;
}) {
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const updated = await tx
      .update(workOrders)
      .set({ projectId: args.projectId, updatedAt: new Date() })
      .where(and(eq(workOrders.orgId, ctx.orgId), eq(workOrders.id, args.workOrderId)))
      .returning();
    if (updated.length === 0) throw new Error("work_order_not_found");
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "work_order",
      targetId: args.workOrderId,
      action: args.projectId ? "attached_to_project" : "detached_from_project",
      actorUserId: userId,
      diff: { projectId: args.projectId },
    });
    return updated[0]!;
  });
}

export { PROJECT_STATUSES };
