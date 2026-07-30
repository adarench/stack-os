CREATE TABLE IF NOT EXISTS "tenant_device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"tenant_user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" text DEFAULT 'ios' NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_device_tokens_org_tenant_idx" ON "tenant_device_tokens" USING btree ("org_id","tenant_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_device_tokens_token_unique" ON "tenant_device_tokens" USING btree ("token");