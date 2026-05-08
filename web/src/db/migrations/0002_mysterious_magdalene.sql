CREATE TYPE "public"."finding_severity" AS ENUM('info', 'observation', 'actionable', 'critical');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inspection_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"inspection_id" uuid NOT NULL,
	"area" text,
	"description" text NOT NULL,
	"severity" "finding_severity" DEFAULT 'observation' NOT NULL,
	"pass" boolean DEFAULT true NOT NULL,
	"spawned_work_order_id" uuid,
	"ordering" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"kind" "inspection_kind" DEFAULT 'ad_hoc' NOT NULL,
	"status" "inspection_status" DEFAULT 'scheduled' NOT NULL,
	"property_id" uuid,
	"unit_id" uuid,
	"inspector_user_id" uuid,
	"notes" text,
	"scheduled_for" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" "project_kind" DEFAULT 'general' NOT NULL,
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"property_id" uuid,
	"unit_id" uuid,
	"budget_cents" numeric,
	"target_completion" timestamp with time zone,
	"gc_user_id" uuid,
	"parent_project_id" uuid,
	"created_by_user_id" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "spawned_from_inspection_id" uuid;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "spawned_from_finding_id" uuid;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspection_findings_org_idx" ON "inspection_findings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspection_findings_inspection_idx" ON "inspection_findings" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspection_findings_severity_idx" ON "inspection_findings" USING btree ("severity","pass");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspections_org_idx" ON "inspections" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspections_status_idx" ON "inspections" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspections_property_idx" ON "inspections" USING btree ("org_id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspections_unit_idx" ON "inspections" USING btree ("org_id","unit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_idx" ON "projects" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_property_idx" ON "projects" USING btree ("org_id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_unit_idx" ON "projects" USING btree ("org_id","unit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_parent_idx" ON "projects" USING btree ("parent_project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_project_idx" ON "work_orders" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_inspection_idx" ON "work_orders" USING btree ("spawned_from_inspection_id");