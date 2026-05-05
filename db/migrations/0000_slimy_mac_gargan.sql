CREATE TYPE "public"."actor_type" AS ENUM('user', 'system', 'inngest', 'vendor');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."assignee_type" AS ENUM('user', 'vendor', 'vendor_user');--> statement-breakpoint
CREATE TYPE "public"."attachment_kind" AS ENUM('before_photo', 'after_photo', 'receipt', 'signed_doc', 'coi', 'general');--> statement-breakpoint
CREATE TYPE "public"."inspection_kind" AS ENUM('move_in', 'move_out', 'annual', 'ad_hoc');--> statement-breakpoint
CREATE TYPE "public"."inspection_status" AS ENUM('scheduled', 'in_progress', 'completed', 'reviewed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'push', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."polymorphic_target" AS ENUM('work_order', 'inspection', 'inspection_finding', 'project', 'vendor', 'vendor_coi', 'tenant_insurance_policy', 'task_template', 'property', 'unit');--> statement-breakpoint
CREATE TYPE "public"."project_kind" AS ENUM('unit_turn', 'capex', 'renovation', 'make_ready', 'general');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'punch_list', 'closing', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."work_order_kind" AS ENUM('work_order', 'ad_hoc', 'unit_turn_item');--> statement-breakpoint
CREATE TYPE "public"."work_order_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('new', 'triaged', 'assigned', 'scheduled', 'in_progress', 'blocked', 'resolved', 'verified', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"target_type" "polymorphic_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"amount_cents" numeric,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"requested_by_user_id" uuid,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"target_type" "polymorphic_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"assignee_type" "assignee_type" NOT NULL,
	"assignee_id" uuid NOT NULL,
	"assigned_by_user_id" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unassigned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"target_type" "polymorphic_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"kind" "attachment_kind" DEFAULT 'general' NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer,
	"filename" text,
	"ordering" integer DEFAULT 0 NOT NULL,
	"uploaded_by_actor_type" "actor_type" DEFAULT 'user' NOT NULL,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"target_type" "polymorphic_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_user_id" uuid,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"target_type" "polymorphic_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"body" text NOT NULL,
	"actor_type" "actor_type" DEFAULT 'user' NOT NULL,
	"actor_user_id" uuid,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text DEFAULT 'US',
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"property_id" uuid NOT NULL,
	"external_id" text,
	"label" text NOT NULL,
	"bedrooms" text,
	"bathrooms" text,
	"square_feet" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" text DEFAULT 'staff' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"primary_contact_name" text,
	"primary_email" text,
	"primary_phone" text,
	"trade" text,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"vendor_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"magic_link_token_hash" text,
	"magic_link_expires_at" timestamp with time zone,
	"last_signed_in_at" timestamp with time zone,
	"status" text DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" "work_order_kind" DEFAULT 'work_order' NOT NULL,
	"status" "work_order_status" DEFAULT 'new' NOT NULL,
	"priority" "work_order_priority" DEFAULT 'normal' NOT NULL,
	"property_id" uuid,
	"unit_id" uuid,
	"parent_work_order_id" uuid,
	"due_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"checked_in_at" timestamp with time zone,
	"check_in_lat" double precision,
	"check_in_lng" double precision,
	"created_by_user_id" uuid,
	"created_by_actor_type" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"target_type" "polymorphic_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "units" ADD CONSTRAINT "units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_users" ADD CONSTRAINT "vendor_users_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_scopes" ADD CONSTRAINT "task_scopes_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_scopes" ADD CONSTRAINT "task_scopes_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_org_idx" ON "approvals" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_target_idx" ON "approvals" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_status_idx" ON "approvals" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_org_idx" ON "assignments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_target_idx" ON "assignments" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_assignee_idx" ON "assignments" USING btree ("assignee_type","assignee_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assignments_active_unique" ON "assignments" USING btree ("target_type","target_id","assignee_type","assignee_id") WHERE unassigned_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_org_idx" ON "attachments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_target_idx" ON "attachments" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_kind_idx" ON "attachments" USING btree ("target_type","target_id","kind","ordering");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_org_idx" ON "audit_log" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_org_idx" ON "comments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_target_idx" ON "comments" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "properties_org_idx" ON "properties" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "properties_ext_idx" ON "properties" USING btree ("org_id","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "units_org_idx" ON "units" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "units_property_idx" ON "units" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "units_ext_unique" ON "units" USING btree ("org_id","property_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_org_unique" ON "users" USING btree ("clerk_user_id","org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_org_idx" ON "users" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendors_org_idx" ON "vendors" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_email_unique" ON "vendors" USING btree ("org_id","primary_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_users_org_idx" ON "vendor_users" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_users_vendor_idx" ON "vendor_users" USING btree ("vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_users_email_unique" ON "vendor_users" USING btree ("org_id","vendor_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_org_idx" ON "work_orders" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_status_idx" ON "work_orders" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_property_idx" ON "work_orders" USING btree ("org_id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_unit_idx" ON "work_orders" USING btree ("org_id","unit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_parent_idx" ON "work_orders" USING btree ("parent_work_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_number_idx" ON "work_orders" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_scopes_org_idx" ON "task_scopes" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_scopes_target_idx" ON "task_scopes" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_scopes_property_idx" ON "task_scopes" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_scopes_unit_idx" ON "task_scopes" USING btree ("unit_id");