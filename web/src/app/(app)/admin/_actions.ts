"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  createProperty,
  createUnit,
  setPropertyAssignee,
  setUserPhone,
} from "@/lib/server/properties";
import { createVendor } from "@/lib/server/vendors";
import { inviteVendorUser } from "@/lib/server/vendor-invite";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/server/auth";
import { isOperatorRole } from "@/lib/server/roles";
import { provisionStaffAccount, setStaffPassword } from "@/lib/server/credentials";
import { provisionTenantAccount, setTenantPassword } from "@/lib/server/tenant-credentials";
import { withScope } from "@/lib/server/db";
import { users } from "@db/schema/users";
import { tenantUsers } from "@db/schema/compliance";
import { recordAuthEvent } from "@/lib/server/auth-events";

async function requireOperator(): Promise<{ orgId: string } | { error: string }> {
  const { userId, orgId, role } = await auth();
  if (!userId || !orgId) return { error: "Not signed in." };
  if (!isOperatorRole(role)) return { error: "You don't have permission." };
  return { orgId };
}

/** Activate / deactivate a staff or resident account (server-enforced). */
export async function setPersonActiveAction(input: {
  type: "staff" | "tenant";
  id: string;
  active: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireOperator();
  if ("error" in gate) return { ok: false, error: gate.error };
  const { orgId } = gate;
  try {
    await withScope({ orgId, actorType: "system" }, (tx) =>
      input.type === "staff"
        ? tx.update(users).set({ status: input.active ? "active" : "deactivated" }).where(and(eq(users.orgId, orgId), eq(users.id, input.id)))
        : tx.update(tenantUsers).set({ status: input.active ? "active" : "revoked" }).where(and(eq(tenantUsers.orgId, orgId), eq(tenantUsers.id, input.id))),
    );
    await recordAuthEvent({
      event: input.active ? "account_reactivated" : "account_deactivated",
      orgId,
      actorType: "user",
      ...(input.type === "staff" ? { subjectUserId: input.id } : { subjectTenantUserId: input.id }),
    });
    revalidatePath("/admin/team");
    revalidatePath("/admin/residents");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}

/** Admin-triggered password reset — sets a temporary password to hand over. */
export async function adminResetPasswordAction(input: {
  type: "staff" | "tenant";
  id: string;
}): Promise<{ ok: boolean; password?: string; error?: string }> {
  const gate = await requireOperator();
  if ("error" in gate) return { ok: false, error: gate.error };
  const { orgId } = gate;
  const password = `Stack-${randomBytes(4).toString("hex")}`;
  try {
    if (input.type === "staff") await setStaffPassword(orgId, input.id, password);
    else await setTenantPassword(orgId, input.id, password);
    await recordAuthEvent({
      event: "password_changed",
      orgId,
      actorType: "user",
      ...(input.type === "staff" ? { subjectUserId: input.id } : { subjectTenantUserId: input.id }),
      meta: { admin_reset: true },
    });
    revalidatePath("/admin/team");
    revalidatePath("/admin/residents");
    return { ok: true, password };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}

/** Correct a resident's unit association. */
export async function reassignTenantUnitAction(input: {
  tenantId: string;
  unitId: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireOperator();
  if ("error" in gate) return { ok: false, error: gate.error };
  const { orgId } = gate;
  try {
    await withScope({ orgId, actorType: "system" }, (tx) =>
      tx.update(tenantUsers).set({ unitId: input.unitId }).where(and(eq(tenantUsers.orgId, orgId), eq(tenantUsers.id, input.tenantId))),
    );
    await recordAuthEvent({ event: "role_changed", orgId, actorType: "user", subjectTenantUserId: input.tenantId, meta: { unit_reassigned: true } });
    revalidatePath("/admin/residents");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}

/**
 * Add a person and hand back an initial username/password to share
 * ("add a tech" / "everybody at Lucid gets their own login"). Operator-gated —
 * provisioning runs under a system scope, so the caller's role is checked here.
 * Returns the one-time credential; the admin copies it to the new user.
 */
export async function addPersonAction(input: {
  type: "technician" | "resident";
  email: string;
  name: string;
  unitId?: string;
}): Promise<{ ok: boolean; email?: string; password?: string; error?: string }> {
  const { userId, orgId, role } = await auth();
  if (!userId || !orgId) return { ok: false, error: "Not signed in." };
  if (!isOperatorRole(role)) return { ok: false, error: "You don't have permission to add people." };

  const email = input.email.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
  const password = `Stack-${randomBytes(4).toString("hex")}`; // 14 chars, typeable

  try {
    if (input.type === "technician") {
      await provisionStaffAccount(orgId, {
        email,
        name: input.name.trim() || undefined,
        role: "technician",
        password,
      });
    } else {
      await provisionTenantAccount(orgId, {
        email,
        name: input.name.trim() || undefined,
        unitId: input.unitId || null,
        password,
      });
    }
    revalidatePath("/admin/team");
    return { ok: true, email, password };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setUserPhoneAction(formData: FormData) {
  await setUserPhone(
    String(formData.get("userId")),
    String(formData.get("phone") ?? "") || null,
  );
  revalidatePath("/admin/team");
}

export async function createPropertyAction(formData: FormData) {
  await createProperty({
    name: String(formData.get("name")),
    addressLine1: String(formData.get("addressLine1") ?? "") || undefined,
    city: String(formData.get("city") ?? "") || undefined,
    state: String(formData.get("state") ?? "") || undefined,
    postalCode: String(formData.get("postalCode") ?? "") || undefined,
  });
  revalidatePath("/admin/properties");
}

export async function setPropertyAssigneeAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  await setPropertyAssignee(
    String(formData.get("propertyId")),
    userId || null,
  );
  revalidatePath("/admin/properties");
}

export async function createUnitAction(formData: FormData) {
  await createUnit({
    propertyId: String(formData.get("propertyId")),
    label: String(formData.get("label")),
    bedrooms: String(formData.get("bedrooms") ?? "") || undefined,
    bathrooms: String(formData.get("bathrooms") ?? "") || undefined,
  });
  revalidatePath("/admin/properties");
}

export async function createVendorAction(formData: FormData) {
  await createVendor({
    name: String(formData.get("name")),
    trade: String(formData.get("trade") ?? "") || undefined,
    primaryEmail: String(formData.get("primaryEmail") ?? "") || undefined,
    primaryPhone: String(formData.get("primaryPhone") ?? "") || undefined,
    primaryContactName: String(formData.get("primaryContactName") ?? "") || undefined,
  });
  revalidatePath("/admin/vendors");
  revalidatePath("/vendors");
}

export async function inviteVendorUserAction(formData: FormData): Promise<void> {
  const result = await inviteVendorUser({
    vendorId: String(formData.get("vendorId")),
    email: String(formData.get("email")),
    name: String(formData.get("name") ?? "") || undefined,
    phone: String(formData.get("phone") ?? "") || undefined,
  });
  // Surface invite URL in dev logs — staff still see the user appear in the list.
  // Until Resend is wired in production, ops may need this URL to ferry to the vendor.
  // eslint-disable-next-line no-console
  console.log("[invite] vendor_user_id=%s url=%s", result.vendorUserId, result.inviteUrl);
  revalidatePath("/admin/vendors");
  revalidatePath("/vendors");
}
