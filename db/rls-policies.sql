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
-- Trusted server code (system/inngest) uses the BYPASSRLS role; everything
-- else hits these policies.
--
-- Re-apply is idempotent: DROP POLICY IF EXISTS + CREATE POLICY.
-- =============================================================================

-- Enable RLS on every entity table.
ALTER TABLE properties              ENABLE ROW LEVEL SECURITY;
ALTER TABLE units                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log               ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals               ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_scopes             ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners — no escape hatch except BYPASSRLS role.
ALTER TABLE properties              FORCE ROW LEVEL SECURITY;
ALTER TABLE units                   FORCE ROW LEVEL SECURITY;
ALTER TABLE users                   FORCE ROW LEVEL SECURITY;
ALTER TABLE vendors                 FORCE ROW LEVEL SECURITY;
ALTER TABLE vendor_users            FORCE ROW LEVEL SECURITY;
ALTER TABLE work_orders             FORCE ROW LEVEL SECURITY;
ALTER TABLE comments                FORCE ROW LEVEL SECURITY;
ALTER TABLE attachments             FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log               FORCE ROW LEVEL SECURITY;
ALTER TABLE approvals               FORCE ROW LEVEL SECURITY;
ALTER TABLE assignments             FORCE ROW LEVEL SECURITY;
ALTER TABLE task_scopes             FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Helper: current_org_id() — reads app.org_id session var, returns NULL if unset.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.org_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_actor_type() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.actor_type', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_vendor_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.vendor_user_id', true), '')::uuid;
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
    'approvals', 'assignments', 'task_scopes'
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
