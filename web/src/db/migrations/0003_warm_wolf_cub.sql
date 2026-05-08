CREATE TYPE "public"."compliance_status" AS ENUM('active', 'expiring', 'expired', 'superseded');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_insurance_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"tenant_user_id" uuid NOT NULL,
	"unit_id" uuid,
	"policy_number" text,
	"carrier" text,
	"coverage_amount_cents" numeric,
	"effective_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"attachment_id" uuid,
	"status" "compliance_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"uploaded_by_actor_type" text DEFAULT 'tenant' NOT NULL,
	"uploaded_by_tenant_user_id" uuid,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"unit_id" uuid,
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
CREATE TABLE IF NOT EXISTS "vendor_cois" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"vendor_id" uuid NOT NULL,
	"policy_number" text,
	"carrier" text,
	"coverage_amount_cents" numeric,
	"effective_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"attachment_id" uuid,
	"status" "compliance_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"uploaded_by_actor_type" text DEFAULT 'user' NOT NULL,
	"uploaded_by_user_id" uuid,
	"uploaded_by_vendor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_insurance_org_idx" ON "tenant_insurance_policies" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_insurance_tenant_idx" ON "tenant_insurance_policies" USING btree ("tenant_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_insurance_status_idx" ON "tenant_insurance_policies" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_insurance_expires_idx" ON "tenant_insurance_policies" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_users_org_idx" ON "tenant_users" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_users_unit_idx" ON "tenant_users" USING btree ("unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_users_email_unique" ON "tenant_users" USING btree ("org_id","unit_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_cois_org_idx" ON "vendor_cois" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_cois_vendor_idx" ON "vendor_cois" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_cois_status_idx" ON "vendor_cois" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_cois_expires_idx" ON "vendor_cois" USING btree ("expires_at");