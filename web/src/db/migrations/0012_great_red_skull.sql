CREATE TABLE IF NOT EXISTS "tenant_push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"tenant_user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "recipient_tenant_user_id" uuid;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_push_subs_org_tenant_idx" ON "tenant_push_subscriptions" USING btree ("org_id","tenant_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_push_subs_endpoint_unique" ON "tenant_push_subscriptions" USING btree ("endpoint");