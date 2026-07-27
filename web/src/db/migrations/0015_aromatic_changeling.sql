CREATE TABLE IF NOT EXISTS "org_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"fallback_assignee_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "floor" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "suite" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_settings_org_unique" ON "org_settings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_companies_org_idx" ON "tenant_companies" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_companies_name_unique" ON "tenant_companies" USING btree ("org_id","name");