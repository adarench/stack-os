import { pgTable, text, uuid, timestamp, numeric, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { id, orgId, timestamps, complianceStatusEnum } from "./_shared";

export const vendorCois = pgTable(
  "vendor_cois",
  {
    id: id(),
    orgId: orgId(),
    vendorId: uuid("vendor_id").notNull(),

    policyNumber: text("policy_number"),
    carrier: text("carrier"),
    coverageAmountCents: numeric("coverage_amount_cents"),
    effectiveAt: timestamp("effective_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // The uploaded document lives in /attachments via target_type='vendor_coi'
    // (polymorphic). We also keep a denormalized FK for quick joins.
    attachmentId: uuid("attachment_id"),

    status: complianceStatusEnum("status").notNull().default("active"),
    notes: text("notes"),
    uploadedByActorType: text("uploaded_by_actor_type").notNull().default("user"),
    uploadedByUserId: uuid("uploaded_by_user_id"),
    uploadedByVendorUserId: uuid("uploaded_by_vendor_user_id"),

    ...timestamps,
  },
  (t) => ({
    orgIdx: index("vendor_cois_org_idx").on(t.orgId),
    vendorIdx: index("vendor_cois_vendor_idx").on(t.vendorId),
    statusIdx: index("vendor_cois_status_idx").on(t.orgId, t.status),
    expiresIdx: index("vendor_cois_expires_idx").on(t.expiresAt),
  }),
);

/**
 * Tenant magic-link identity. Mirrors the `vendor_users` pattern:
 * external participant, NOT in Clerk, gets a signed-cookie session
 * after consuming a one-shot magic-link token.
 *
 * `unit_id` is the unit they live in. A tenant who moves units gets a
 * new tenant_users row (the magic-link is throwaway). Tenants serving
 * multiple PMs (rare) would have one row per granting PM-org.
 */
export const tenantUsers = pgTable(
  "tenant_users",
  {
    id: id(),
    orgId: orgId(),
    unitId: uuid("unit_id"),
    // Occupying tenant company (M3 · LOC-004/005). Additive + nullable.
    companyId: uuid("company_id"),

    email: text("email").notNull(),
    name: text("name"),
    phone: text("phone"),

    magicLinkTokenHash: text("magic_link_token_hash"),
    magicLinkExpiresAt: timestamp("magic_link_expires_at", { withTimezone: true }),
    lastSignedInAt: timestamp("last_signed_in_at", { withTimezone: true }),
    status: text("status").notNull().default("invited"), // invited | active | revoked

    // --- Credential auth (M1). Tenants log in with email + password; magic-link
    // stays for invite/reset. Additive + nullable. ---
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    // Password reset (hashed, single-use, expiring). Additive + nullable.
    passwordResetTokenHash: text("password_reset_token_hash"),
    passwordResetExpiresAt: timestamp("password_reset_expires_at", { withTimezone: true }),

    ...timestamps,
  },
  (t) => ({
    orgIdx: index("tenant_users_org_idx").on(t.orgId),
    unitIdx: index("tenant_users_unit_idx").on(t.unitId),
    emailUnique: uniqueIndex("tenant_users_email_unique").on(t.orgId, t.unitId, t.email),
  }),
);

export const tenantInsurancePolicies = pgTable(
  "tenant_insurance_policies",
  {
    id: id(),
    orgId: orgId(),
    tenantUserId: uuid("tenant_user_id").notNull(),
    unitId: uuid("unit_id"),

    policyNumber: text("policy_number"),
    carrier: text("carrier"),
    coverageAmountCents: numeric("coverage_amount_cents"),
    effectiveAt: timestamp("effective_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    attachmentId: uuid("attachment_id"),
    status: complianceStatusEnum("status").notNull().default("active"),
    notes: text("notes"),

    uploadedByActorType: text("uploaded_by_actor_type").notNull().default("tenant"),
    uploadedByTenantUserId: uuid("uploaded_by_tenant_user_id"),
    uploadedByUserId: uuid("uploaded_by_user_id"),

    ...timestamps,
  },
  (t) => ({
    orgIdx: index("tenant_insurance_org_idx").on(t.orgId),
    tenantIdx: index("tenant_insurance_tenant_idx").on(t.tenantUserId),
    statusIdx: index("tenant_insurance_status_idx").on(t.orgId, t.status),
    expiresIdx: index("tenant_insurance_expires_idx").on(t.expiresAt),
  }),
);
