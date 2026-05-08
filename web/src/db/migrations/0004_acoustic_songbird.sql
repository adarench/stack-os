CREATE TYPE "public"."cost_kind" AS ENUM('labor', 'materials', 'fee', 'other');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'submitted', 'approved', 'paid', 'disputed', 'void');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"vendor_id" uuid NOT NULL,
	"work_order_id" uuid,
	"invoice_number" text,
	"total_cents" numeric NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"attachment_id" uuid,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"notes" text,
	"submitted_by_actor_type" text,
	"submitted_by_vendor_user_id" uuid,
	"approved_by_user_id" uuid,
	"paid_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"work_order_id" uuid NOT NULL,
	"kind" "cost_kind" DEFAULT 'other' NOT NULL,
	"description" text,
	"amount_cents" numeric NOT NULL,
	"entered_by_actor_type" text DEFAULT 'user' NOT NULL,
	"entered_by_user_id" uuid,
	"entered_by_vendor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"work_order_id" uuid NOT NULL,
	"vendor_user_id" uuid,
	"user_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"hours_decimal" double precision,
	"hourly_rate_cents" numeric,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_org_idx" ON "invoices" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_vendor_idx" ON "invoices" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_work_order_idx" ON "invoices" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_costs_org_idx" ON "task_costs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_costs_work_order_idx" ON "task_costs" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_time_entries_org_idx" ON "task_time_entries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_time_entries_work_order_idx" ON "task_time_entries" USING btree ("work_order_id");