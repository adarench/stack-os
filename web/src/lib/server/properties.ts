import "server-only";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { properties } from "@db/schema/properties";
import { units } from "@db/schema/units";
import { users } from "@db/schema/users";
import { withStaffScope } from "./db";
import { writeAudit } from "./audit";
import { ensureUserRow } from "./sync-user";

export const createPropertyInput = z.object({
  name: z.string().min(1).max(200),
  addressLine1: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(40).optional(),
  postalCode: z.string().max(20).optional(),
  timezone: z.string().max(60).default("America/New_York"),
});

export async function createProperty(input: z.input<typeof createPropertyInput>) {
  const parsed = createPropertyInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const inserted = await tx
      .insert(properties)
      .values({
        orgId: ctx.orgId,
        name: parsed.name,
        addressLine1: parsed.addressLine1 ?? null,
        city: parsed.city ?? null,
        state: parsed.state ?? null,
        postalCode: parsed.postalCode ?? null,
        timezone: parsed.timezone,
      })
      .returning();
    const row = inserted[0]!;
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "property",
      targetId: row.id,
      action: "created",
      actorUserId: userId,
      diff: { to: { name: parsed.name } },
    });
    return row;
  });
}

export async function listProperties() {
  return withStaffScope(async (tx, ctx) =>
    tx
      .select()
      .from(properties)
      .where(eq(properties.orgId, ctx.orgId))
      .orderBy(asc(properties.name)),
  );
}

/** Staff users in the org — the pool a property can be "covered by". */
export async function listStaffUsers() {
  return withStaffScope(async (tx, ctx) =>
    tx
      .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.orgId, ctx.orgId))
      .orderBy(asc(users.name)),
  );
}

/**
 * Set (or clear) a staff user's mobile number for SMS dispatch. New-assignment
 * texts only fire for techs with a number on file.
 */
export async function setUserPhone(userId: string, phone: string | null) {
  return withStaffScope(async (tx, ctx) => {
    const normalized = phone?.trim() || null;
    const updated = await tx
      .update(users)
      .set({ phone: normalized, updatedAt: new Date() })
      .where(and(eq(users.orgId, ctx.orgId), eq(users.id, userId)))
      .returning({ id: users.id });
    return updated[0] ?? null;
  });
}

/**
 * Set (or clear) the technician who covers a property. New work orders on this
 * property auto-route to that user — this is what makes "nothing Unassigned"
 * real. Pass null to clear.
 */
export async function setPropertyAssignee(propertyId: string, userId: string | null) {
  return withStaffScope(async (tx, ctx) => {
    const actorId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const updated = await tx
      .update(properties)
      .set({ defaultAssigneeUserId: userId, updatedAt: new Date() })
      .where(and(eq(properties.orgId, ctx.orgId), eq(properties.id, propertyId)))
      .returning();
    if (updated[0]) {
      await writeAudit(tx, {
        orgId: ctx.orgId,
        targetType: "property",
        targetId: propertyId,
        action: "assignee_set",
        actorUserId: actorId,
        diff: { to: { defaultAssigneeUserId: userId } },
      });
    }
    return updated[0] ?? null;
  });
}

export const createUnitInput = z.object({
  propertyId: z.string().uuid(),
  label: z.string().min(1).max(60),
  bedrooms: z.string().max(10).optional(),
  bathrooms: z.string().max(10).optional(),
  squareFeet: z.string().max(10).optional(),
});

export async function createUnit(input: z.infer<typeof createUnitInput>) {
  const parsed = createUnitInput.parse(input);
  return withStaffScope(async (tx, ctx) => {
    const userId = await ensureUserRow(tx, ctx.orgId, ctx.userId);
    const inserted = await tx
      .insert(units)
      .values({
        orgId: ctx.orgId,
        propertyId: parsed.propertyId,
        label: parsed.label,
        bedrooms: parsed.bedrooms ?? null,
        bathrooms: parsed.bathrooms ?? null,
        squareFeet: parsed.squareFeet ?? null,
      })
      .returning();
    const row = inserted[0]!;
    await writeAudit(tx, {
      orgId: ctx.orgId,
      targetType: "unit",
      targetId: row.id,
      action: "created",
      actorUserId: userId,
      diff: { to: { label: parsed.label, propertyId: parsed.propertyId } },
    });
    return row;
  });
}

export async function listUnits(propertyId?: string) {
  return withStaffScope(async (tx, ctx) => {
    const conds = [eq(units.orgId, ctx.orgId)];
    if (propertyId) conds.push(eq(units.propertyId, propertyId));
    return tx.select().from(units).where(and(...conds)).orderBy(asc(units.label));
  });
}
