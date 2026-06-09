CREATE TYPE "public"."follow_up_source" AS ENUM('trello', 'email', 'text', 'appfolio', 'manual');--> statement-breakpoint
CREATE TYPE "public"."follow_up_status" AS ENUM('open', 'snoozed', 'done');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"target_type" "polymorphic_target",
	"target_id" uuid,
	"title" text NOT NULL,
	"source_channel" "follow_up_source" DEFAULT 'manual' NOT NULL,
	"source_url" text,
	"external_id" text,
	"owner_user_id" uuid,
	"follow_up_at" timestamp with time zone,
	"status" "follow_up_status" DEFAULT 'open' NOT NULL,
	"next_action" text,
	"last_touched_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follow_ups_org_idx" ON "follow_ups" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follow_ups_status_idx" ON "follow_ups" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follow_ups_target_idx" ON "follow_ups" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follow_ups_external_idx" ON "follow_ups" USING btree ("org_id","external_id");