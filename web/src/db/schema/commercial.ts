import { pgTable, text, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { id, orgId, timestamps } from "./_shared";

/**
 * Commercial location/company model (M3 · LOC-*).
 *
 * Pragmatic realization of the full-commercial-hierarchy decision (LR-011):
 * `properties` = building, `units` = suite (now carrying `floor`/`suite`), plus
 * a first-class `tenant_companies` entity for the occupying company and
 * `org_settings` for org-level routing config (fallback assignee → ASN-003/008).
 */
export const tenantCompanies = pgTable(
  "tenant_companies",
  {
    id: id(),
    orgId: orgId(),
    name: text("name").notNull(),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("tenant_companies_org_idx").on(t.orgId),
    nameUnique: uniqueIndex("tenant_companies_name_unique").on(t.orgId, t.name),
  }),
);

/**
 * One row per org. Holds org-level routing config — most importantly the
 * fallback assignee used when no building/property covering tech is set, so a
 * resident-submitted WO is never silently left unassigned (ASN-003/008).
 */
export const orgSettings = pgTable(
  "org_settings",
  {
    id: id(),
    orgId: orgId(),
    fallbackAssigneeUserId: uuid("fallback_assignee_user_id"),
    ...timestamps,
  },
  (t) => ({
    orgUnique: uniqueIndex("org_settings_org_unique").on(t.orgId),
  }),
);
