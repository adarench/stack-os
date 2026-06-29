-- =============================================================================
-- Stack OS — Row Level Security policies
-- =============================================================================
--
-- This file is hand-written and applied AFTER drizzle migrations by
-- /scripts/db-migrate.ts. Drizzle does not generate RLS.
--
-- Tenant model:
--   - app.org_id          — Clerk organization id (staff scope)
--   - app.actor_type      — 'user' | 'vendor' | 'system' | 'inngest'
--   - app.vendor_user_id  — vendor_users.id (when actor_type='vendor')
--
-- The app sets these via SET LOCAL inside a per-request transaction.
--
-- IMPORTANT: Neon's default owner role (e.g. neondb_owner) has BYPASSRLS,
-- which would defeat RLS entirely. We create an `app_user` role WITHOUT
-- BYPASSRLS and require app code (and tests) to `SET LOCAL ROLE app_user`
-- per transaction. The owner role retains BYPASSRLS so migrations and
-- maintenance can still run.
--
-- Re-apply is idempotent: DROP POLICY IF EXISTS + CREATE POLICY.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- App role (RLS-enforced). Idempotent.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END $$;

-- Allow the connecting role (current_user, typically the DB owner) to
-- `SET ROLE app_user`. Without this, SET ROLE fails with "permission denied".
DO $$
DECLARE
  owner_role text := current_user;
BEGIN
  EXECUTE format('GRANT app_user TO %I', owner_role);
END $$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Future-proof: any new tables/sequences created under the current role
-- automatically grant to app_user, so we don't have to re-grant after each
-- migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO app_user;

-- Enable RLS on every entity table.
ALTER TABLE properties               ENABLE ROW LEVEL SECURITY;
ALTER TABLE units                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals                ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_scopes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_template_fires      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_findings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_cois              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_costs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_time_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups               ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners — no escape hatch except BYPASSRLS role.
ALTER TABLE properties               FORCE ROW LEVEL SECURITY;
ALTER TABLE units                    FORCE ROW LEVEL SECURITY;
ALTER TABLE users                    FORCE ROW LEVEL SECURITY;
ALTER TABLE vendors                  FORCE ROW LEVEL SECURITY;
ALTER TABLE vendor_users             FORCE ROW LEVEL SECURITY;
ALTER TABLE work_orders              FORCE ROW LEVEL SECURITY;
ALTER TABLE comments                 FORCE ROW LEVEL SECURITY;
ALTER TABLE attachments              FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log                FORCE ROW LEVEL SECURITY;
ALTER TABLE approvals                FORCE ROW LEVEL SECURITY;
ALTER TABLE assignments              FORCE ROW LEVEL SECURITY;
ALTER TABLE task_scopes              FORCE ROW LEVEL SECURITY;
ALTER TABLE task_templates           FORCE ROW LEVEL SECURITY;
ALTER TABLE task_template_fires      FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications            FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions       FORCE ROW LEVEL SECURITY;
ALTER TABLE inspections              FORCE ROW LEVEL SECURITY;
ALTER TABLE inspection_findings      FORCE ROW LEVEL SECURITY;
ALTER TABLE inspection_items         FORCE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates      FORCE ROW LEVEL SECURITY;
ALTER TABLE checklist_template_items FORCE ROW LEVEL SECURITY;
ALTER TABLE projects                 FORCE ROW LEVEL SECURITY;
ALTER TABLE vendor_cois              FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_users             FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_insurance_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE task_costs               FORCE ROW LEVEL SECURITY;
ALTER TABLE task_time_entries        FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices                 FORCE ROW LEVEL SECURITY;
ALTER TABLE follow_ups               FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Helper: current_org_id() — reads app.org_id session var, returns NULL if unset.
-- Clerk org IDs are text (e.g. "org_2abc...").
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_org_id() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.org_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_actor_type() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.actor_type', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_vendor_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.vendor_user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_tenant_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant_user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- -----------------------------------------------------------------------------
-- Generic org-scope policy template (staff users).
-- A row is visible iff its org_id matches the session's org_id AND the
-- actor is a staff user (not a vendor).
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'properties', 'units', 'users', 'vendors', 'vendor_users',
    'work_orders', 'comments', 'attachments', 'audit_log',
    'approvals', 'assignments', 'task_scopes',
    'task_templates', 'task_template_fires',
    'notifications', 'notification_preferences', 'push_subscriptions',
    'inspections', 'inspection_findings', 'projects',
    'inspection_items', 'checklist_templates', 'checklist_template_items',
    'vendor_cois', 'tenant_users', 'tenant_insurance_policies',
    'task_costs', 'task_time_entries', 'invoices', 'follow_ups'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_staff_org ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_staff_org ON %I FOR ALL TO PUBLIC '
      || 'USING (org_id = current_org_id() AND coalesce(current_actor_type(), ''user'') IN (''user'', ''system'', ''inngest'')) '
      || 'WITH CHECK (org_id = current_org_id() AND coalesce(current_actor_type(), ''user'') IN (''user'', ''system'', ''inngest''))',
      t, t
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Vendor user policies — narrow read access to scoped resources.
--
-- A vendor_user can:
--   - SELECT their own vendor_users row (and other vendor_users in the same
--     vendor, same org).
--   - SELECT work_orders where an active assignments row points at them
--     (assigneeType='vendor_user', assigneeId=current_vendor_user_id()).
--   - SELECT/INSERT comments on those work_orders with visibility='external'.
--   - SELECT/INSERT attachments on those work_orders.
--
-- More elaborate vendor scoping (vendor-level vs vendor_user-level) is added
-- in P5 alongside the vendor portal.
-- -----------------------------------------------------------------------------

-- vendor_users self-scope
DROP POLICY IF EXISTS vendor_users_self ON vendor_users;
CREATE POLICY vendor_users_self ON vendor_users FOR SELECT TO PUBLIC
USING (
  current_actor_type() = 'vendor'
  AND org_id = current_org_id()
  AND id = current_vendor_user_id()
);

-- system-actor cross-org SELECT — used ONLY by the magic-link verify flow
-- to resolve a token hash to its owning org. App code is trusted; user-driven
-- paths must NEVER set actor_type='system'.
DROP POLICY IF EXISTS vendor_users_system_lookup ON vendor_users;
CREATE POLICY vendor_users_system_lookup ON vendor_users FOR SELECT TO PUBLIC
USING (current_actor_type() = 'system');

-- system-actor cross-org SELECT on task_templates — used by the Inngest
-- cron to scan all orgs for due templates. Same trust boundary: only
-- trusted server code (jobs, scripts) sets actor_type='system'.
DROP POLICY IF EXISTS task_templates_system_scan ON task_templates;
CREATE POLICY task_templates_system_scan ON task_templates FOR SELECT TO PUBLIC
USING (current_actor_type() = 'system');

-- Cross-org system scan policies for the compliance sweeps.
DROP POLICY IF EXISTS vendor_cois_system_scan ON vendor_cois;
CREATE POLICY vendor_cois_system_scan ON vendor_cois FOR SELECT TO PUBLIC
USING (current_actor_type() = 'system');

DROP POLICY IF EXISTS tenant_insurance_system_scan ON tenant_insurance_policies;
CREATE POLICY tenant_insurance_system_scan ON tenant_insurance_policies FOR SELECT TO PUBLIC
USING (current_actor_type() = 'system');

-- tenant_users self-scope (mirror of vendor_users_self).
DROP POLICY IF EXISTS tenant_users_self ON tenant_users;
CREATE POLICY tenant_users_self ON tenant_users FOR SELECT TO PUBLIC
USING (
  current_actor_type() = 'tenant'
  AND org_id = current_org_id()
  AND id = current_tenant_user_id()
);

-- system cross-org lookup for magic-link verify.
DROP POLICY IF EXISTS tenant_users_system_lookup ON tenant_users;
CREATE POLICY tenant_users_system_lookup ON tenant_users FOR SELECT TO PUBLIC
USING (current_actor_type() = 'system');

-- Tenant scope on their own insurance policies.
DROP POLICY IF EXISTS tenant_insurance_self ON tenant_insurance_policies;
CREATE POLICY tenant_insurance_self ON tenant_insurance_policies FOR SELECT TO PUBLIC
USING (
  current_actor_type() = 'tenant'
  AND org_id = current_org_id()
  AND tenant_user_id = current_tenant_user_id()
);
DROP POLICY IF EXISTS tenant_insurance_self_insert ON tenant_insurance_policies;
CREATE POLICY tenant_insurance_self_insert ON tenant_insurance_policies FOR INSERT TO PUBLIC
WITH CHECK (
  current_actor_type() = 'tenant'
  AND org_id = current_org_id()
  AND tenant_user_id = current_tenant_user_id()
);

-- Tenant read scope for the mobile tenant app (read-only; mirrors the
-- insurance-self pattern). "Own unit" = the unit on the tenant's row.
-- The tenant sees only their own unit, that unit's property, and the work
-- orders on that unit. Writes (submit/comment/confirm) come in later phases.
DROP POLICY IF EXISTS units_tenant_self ON units;
CREATE POLICY units_tenant_self ON units FOR SELECT TO PUBLIC
USING (
  current_actor_type() = 'tenant'
  AND org_id = current_org_id()
  AND id = (SELECT unit_id FROM tenant_users WHERE id = current_tenant_user_id())
);

DROP POLICY IF EXISTS properties_tenant_self ON properties;
CREATE POLICY properties_tenant_self ON properties FOR SELECT TO PUBLIC
USING (
  current_actor_type() = 'tenant'
  AND org_id = current_org_id()
  AND id = (
    SELECT u.property_id FROM units u
    WHERE u.id = (SELECT unit_id FROM tenant_users WHERE id = current_tenant_user_id())
  )
);

DROP POLICY IF EXISTS work_orders_tenant_self ON work_orders;
CREATE POLICY work_orders_tenant_self ON work_orders FOR SELECT TO PUBLIC
USING (
  current_actor_type() = 'tenant'
  AND org_id = current_org_id()
  AND unit_id = (SELECT unit_id FROM tenant_users WHERE id = current_tenant_user_id())
);

-- Tenant can read attachments on their own-unit work orders (photos they and
-- ops add). Writes happen under a validated system scope, so no tenant INSERT
-- policy here. The inner work_orders read is itself RLS-scoped to own-unit.
DROP POLICY IF EXISTS attachments_tenant_self ON attachments;
CREATE POLICY attachments_tenant_self ON attachments FOR SELECT TO PUBLIC
USING (
  current_actor_type() = 'tenant'
  AND org_id = current_org_id()
  AND target_type = 'work_order'
  AND target_id IN (
    SELECT id FROM work_orders
    WHERE unit_id = (SELECT unit_id FROM tenant_users WHERE id = current_tenant_user_id())
  )
);

-- Tenant can read EXTERNAL comments on their own-unit work orders (the chat
-- thread). Internal staff notes are excluded by the visibility clause and
-- never returned. Tenant writes go through a validated system scope.
DROP POLICY IF EXISTS comments_tenant_self ON comments;
CREATE POLICY comments_tenant_self ON comments FOR SELECT TO PUBLIC
USING (
  current_actor_type() = 'tenant'
  AND org_id = current_org_id()
  AND visibility = 'external'
  AND target_type = 'work_order'
  AND target_id IN (
    SELECT id FROM work_orders
    WHERE unit_id = (SELECT unit_id FROM tenant_users WHERE id = current_tenant_user_id())
  )
);

-- assignments visible to the vendor user (so the EXISTS subquery in
-- work_orders_vendor_assigned can resolve under the vendor scope).
DROP POLICY IF EXISTS assignments_vendor_self ON assignments;
CREATE POLICY assignments_vendor_self ON assignments FOR SELECT TO PUBLIC
USING (
  current_actor_type() = 'vendor'
  AND org_id = current_org_id()
  AND assignee_type = 'vendor_user'
  AND assignee_id = current_vendor_user_id()
);

-- work_orders assigned to the vendor user
DROP POLICY IF EXISTS work_orders_vendor_assigned ON work_orders;
CREATE POLICY work_orders_vendor_assigned ON work_orders FOR SELECT TO PUBLIC
USING (
  current_actor_type() = 'vendor'
  AND org_id = current_org_id()
  AND EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.target_type = 'work_order'
      AND a.target_id = work_orders.id
      AND a.assignee_type = 'vendor_user'
      AND a.assignee_id = current_vendor_user_id()
      AND a.unassigned_at IS NULL
  )
);

-- comments on those work_orders, only external visibility
DROP POLICY IF EXISTS comments_vendor_external ON comments;
CREATE POLICY comments_vendor_external ON comments FOR SELECT TO PUBLIC
USING (
  current_actor_type() = 'vendor'
  AND org_id = current_org_id()
  AND visibility = 'external'
  AND target_type = 'work_order'
  AND EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.target_type = 'work_order'
      AND a.target_id = comments.target_id
      AND a.assignee_type = 'vendor_user'
      AND a.assignee_id = current_vendor_user_id()
      AND a.unassigned_at IS NULL
  )
);

DROP POLICY IF EXISTS comments_vendor_insert ON comments;
CREATE POLICY comments_vendor_insert ON comments FOR INSERT TO PUBLIC
WITH CHECK (
  current_actor_type() = 'vendor'
  AND org_id = current_org_id()
  AND visibility = 'external'
  AND target_type = 'work_order'
  AND EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.target_type = 'work_order'
      AND a.target_id = comments.target_id
      AND a.assignee_type = 'vendor_user'
      AND a.assignee_id = current_vendor_user_id()
      AND a.unassigned_at IS NULL
  )
);

-- attachments on those work_orders
DROP POLICY IF EXISTS attachments_vendor_read ON attachments;
CREATE POLICY attachments_vendor_read ON attachments FOR SELECT TO PUBLIC
USING (
  current_actor_type() = 'vendor'
  AND org_id = current_org_id()
  AND target_type = 'work_order'
  AND EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.target_type = 'work_order'
      AND a.target_id = attachments.target_id
      AND a.assignee_type = 'vendor_user'
      AND a.assignee_id = current_vendor_user_id()
      AND a.unassigned_at IS NULL
  )
);

DROP POLICY IF EXISTS attachments_vendor_insert ON attachments;
CREATE POLICY attachments_vendor_insert ON attachments FOR INSERT TO PUBLIC
WITH CHECK (
  current_actor_type() = 'vendor'
  AND org_id = current_org_id()
  AND target_type = 'work_order'
  AND EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.target_type = 'work_order'
      AND a.target_id = attachments.target_id
      AND a.assignee_type = 'vendor_user'
      AND a.assignee_id = current_vendor_user_id()
      AND a.unassigned_at IS NULL
  )
);
