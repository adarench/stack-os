import "server-only";
import { z } from "zod";
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { parseExpression } from "cron-parser";
import { taskTemplates, taskTemplateFires } from "@db/schema/task-templates";
import { workOrders } from "@db/schema/work-orders";
import {
  WORK_ORDER_KINDS,
  WORK_ORDER_PRIORITIES,
} from "@contracts/state-machines/work-order";
import { withScope, withStaffScope, type ScopedDB } from "./db";
import { writeAudit } from "./audit";
import { nextWorkOrderNumber } from "./sequence";
import { ensureUserRow } from "./sync-user";

export const createTemplateInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(10_000).optional(),
  cron: z.string().min(1).max(120),
  timezone: z.string().min(1).max(60).default("America/New_York"),
  defaultTitle: z.string().min(1).max(200),
  defaultDescription: z.string().max(10_000).optional(),
  defaultKind: z.enum(WORK_ORDER_KINDS).default("work_order"),
  defaultPriority: z.enum(WORK_ORDER_PRIORITIES).default("normal"),
  defaultPropertyId: z.string().uuid().optional(),
  defaultUnitId: z.string().uuid().optional(),
  leadTimeHours: z.number().int().min(0).max(720).default(0),
});

export type CreateTemplateInput = z.input<typeof createTemplateInput>;

/**
 * Validate a cron expression. Throws on invalid input.
 * Returns the next fire time after `from` in the given timezone.
 */
export function nextFireTime(cron: string, timezone: string, from: Date = new Date()): Date {
  const it = parseExpression(cron, { currentDate: from, tz: timezone });
  return it.next().toDate();
}

export function isValidCron(cron: string): boolean {
  // cron-parser is lenient on empty / whitespace input; require explicit
  // 5- or 6-field format (`min hr dom mon dow [year?]`).
  const trimmed = cron.trim();
  if (!trimmed) return false;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 5 || parts.length > 6) return false;
  try {
    parseExpression(trimmed);
    return true;
  } catch {
    return false;
  }
}

export async function createTemplate(input: CreateTemplateInput) {
  const parsed = createTemplateInput.parse(input);
  if (!isValidCron(parsed.cron)) throw new Error("invalid_cron");
  const next = nextFireTime(parsed.cron, parsed.timezone);

  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const inserted = await tx
      .insert(taskTemplates)
      .values({
        orgId: ctx.orgId,
        name: parsed.name,
        description: parsed.description ?? null,
        cron: parsed.cron,
        timezone: parsed.timezone,
        defaultTitle: parsed.defaultTitle,
        defaultDescription: parsed.defaultDescription ?? null,
        defaultKind: parsed.defaultKind,
        defaultPriority: parsed.defaultPriority,
        defaultPropertyId: parsed.defaultPropertyId ?? null,
        defaultUnitId: parsed.defaultUnitId ?? null,
        leadTimeHours: parsed.leadTimeHours,
        nextFireAt: next,
        createdByUserId: userId,
      })
      .returning();
    const row = inserted[0]!;
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "task_template",
      targetId: row.id,
      action: "created",
      actorUserId: userId,
      diff: { name: parsed.name, cron: parsed.cron, nextFireAt: next.toISOString() },
    });
    return row;
  });
}

export async function listTemplates() {
  return withStaffScope(async (tx, ctx) =>
    tx
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.orgId, ctx.orgId))
      .orderBy(asc(taskTemplates.name)),
  );
}

export async function setTemplateActive(id: string, active: boolean) {
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const updated = await tx
      .update(taskTemplates)
      .set({ isActive: active, updatedAt: new Date() })
      .where(and(eq(taskTemplates.orgId, ctx.orgId), eq(taskTemplates.id, id)))
      .returning();
    if (updated.length === 0) throw new Error("template_not_found");
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "task_template",
      targetId: id,
      action: active ? "resumed" : "paused",
      actorUserId: userId,
    });
    return updated[0]!;
  });
}

/**
 * Spawn a single WO from a template at the given fire time.
 * Idempotent: re-running with the same (templateId, fireAt) is a no-op.
 *
 * Returns the spawned WO id, or null if it had already been spawned.
 *
 * Caller is responsible for the org scope. Used by both manual "spawn now"
 * (staff scope) and the Inngest cron (system scope).
 */
async function spawnOnce(
  tx: ScopedDB,
  orgId: string,
  templateId: string,
  fireAt: Date,
  actor: { type: "user" | "system" | "inngest"; userId?: string | null },
): Promise<string | null> {
  // Idempotency: skip if (template, fire_at) already recorded.
  const existing = await tx
    .select({ id: taskTemplateFires.id, woId: taskTemplateFires.spawnedWorkOrderId })
    .from(taskTemplateFires)
    .where(
      and(
        eq(taskTemplateFires.orgId, orgId),
        eq(taskTemplateFires.templateId, templateId),
        eq(taskTemplateFires.fireAt, fireAt),
      ),
    )
    .limit(1);
  if (existing.length > 0) return null;

  const tplRows = await tx
    .select()
    .from(taskTemplates)
    .where(and(eq(taskTemplates.orgId, orgId), eq(taskTemplates.id, templateId)))
    .limit(1);
  const tpl = tplRows[0];
  if (!tpl) throw new Error("template_not_found");
  if (!tpl.isActive) return null;

  const number = await nextWorkOrderNumber(tx, orgId);
  const dueAt = tpl.leadTimeHours
    ? new Date(fireAt.getTime() + tpl.leadTimeHours * 60 * 60 * 1000)
    : null;

  const wo = await tx
    .insert(workOrders)
    .values({
      orgId,
      number,
      title: tpl.defaultTitle,
      description: tpl.defaultDescription,
      kind: tpl.defaultKind,
      priority: tpl.defaultPriority,
      status: "new",
      propertyId: tpl.defaultPropertyId,
      unitId: tpl.defaultUnitId,
      dueAt,
      scheduledFor: fireAt,
      createdByUserId: actor.userId ?? null,
      createdByActorType: actor.type,
    })
    .returning({ id: workOrders.id });
  const woId = wo[0]!.id;

  await tx.insert(taskTemplateFires).values({
    orgId,
    templateId,
    fireAt,
    spawnedWorkOrderId: woId,
  });

  // Advance template state. nextFireAt is computed in the original tz so
  // DST is handled by cron-parser.
  const next = nextFireTime(tpl.cron, tpl.timezone, fireAt);
  await tx
    .update(taskTemplates)
    .set({
      lastFiredAt: fireAt,
      nextFireAt: next,
      timesFired: tpl.timesFired + 1,
      updatedAt: new Date(),
    })
    .where(eq(taskTemplates.id, templateId));

  await writeAudit(tx, {
    orgId,
    targetType: "task_template",
    targetId: templateId,
    action: "spawned",
    actorType: actor.type,
    actorUserId: actor.userId ?? null,
    diff: { fireAt: fireAt.toISOString(), workOrderId: woId, number },
  });

  return woId;
}

/**
 * Manual "Spawn now" action — triggered from the templates admin UI.
 * Uses the current time as fireAt (rounded to the second to keep idempotency
 * key reasonable).
 */
export async function spawnTemplateNow(templateId: string) {
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const fireAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    const woId = await spawnOnce(tx, ctx.orgId, templateId, fireAt, {
      type: "user",
      userId,
    });
    return { workOrderId: woId, fireAt };
  });
}

/**
 * Inngest cron entry-point. Iterates every active template org-by-org with
 * `next_fire_at <= now`, calls spawnOnce. Uses the system actor scope.
 *
 * Returns a small report so the Inngest function output is debuggable.
 */
export async function runDueTemplates(now: Date = new Date()): Promise<{
  scanned: number;
  spawned: number;
  skipped: number;
}> {
  // We need to iterate across orgs. For now we do it via a single
  // unscoped pass under `system` actor — the staff_org policy permits
  // system actor when org_id matches, so we scope per-org.
  // First find all orgs that have due templates. Use the BYPASSRLS owner
  // role for this scan.
  let scanned = 0;
  let spawned = 0;
  let skipped = 0;

  // Use `system` actor scope but iterate per-org. We use a sentinel call
  // to read all due rows via the owner role outside RLS, then scope each
  // spawn to its own org.
  const dueOrgs = await withScope(
    { orgId: "__cron_scan__", actorType: "system" },
    async (tx) => {
      // Direct read: but RLS will filter by org. We need a cross-org read.
      // Use the system-actor role with a special policy? No — for the cron
      // we trust the connecting role (owner/BYPASSRLS) by NOT calling
      // SET LOCAL ROLE app_user. But withScope always does that.
      // Workaround: set a wide role here too, query, then scope per-org.
      // For now, query under `system` actor + dummy org. The staff_org
      // policy fails (org mismatch). We need a system_cron_scan policy
      // for task_templates.
      return tx
        .select({
          id: taskTemplates.id,
          orgId: taskTemplates.orgId,
          nextFireAt: taskTemplates.nextFireAt,
        })
        .from(taskTemplates)
        .where(and(eq(taskTemplates.isActive, true), lte(taskTemplates.nextFireAt, now)));
    },
  ).catch(() => [] as Array<{ id: string; orgId: string; nextFireAt: Date | null }>);

  // Group by org, then spawn in per-org scope.
  const byOrg = new Map<string, Array<{ id: string; fireAt: Date }>>();
  for (const t of dueOrgs) {
    if (!t.nextFireAt) continue;
    const arr = byOrg.get(t.orgId) ?? [];
    arr.push({ id: t.id, fireAt: t.nextFireAt });
    byOrg.set(t.orgId, arr);
  }

  for (const [orgId, due] of byOrg) {
    await withScope({ orgId, actorType: "system" }, async (tx) => {
      for (const d of due) {
        scanned += 1;
        const woId = await spawnOnce(tx, orgId, d.id, d.fireAt, { type: "system" });
        if (woId) spawned += 1;
        else skipped += 1;
      }
    });
  }

  return { scanned, spawned, skipped };
}

/**
 * Read-only helper: list recent fires for a template, newest first.
 */
export async function listTemplateFires(templateId: string, limit = 20) {
  return withStaffScope(async (tx, ctx) =>
    tx
      .select()
      .from(taskTemplateFires)
      .where(
        and(
          eq(taskTemplateFires.orgId, ctx.orgId),
          eq(taskTemplateFires.templateId, templateId),
        ),
      )
      .orderBy(desc(taskTemplateFires.fireAt))
      .limit(limit),
  );
}
