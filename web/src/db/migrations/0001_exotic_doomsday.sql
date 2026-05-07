CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"user_id" uuid,
	"vendor_user_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"recipient_user_id" uuid,
	"recipient_vendor_user_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"kind" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"target_type" "polymorphic_target",
	"target_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	"provider_message_id" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_template_fires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"template_id" uuid NOT NULL,
	"fire_at" timestamp with time zone NOT NULL,
	"spawned_work_order_id" uuid,
	"spawned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cron" text NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"default_title" text NOT NULL,
	"default_description" text,
	"default_kind" "work_order_kind" DEFAULT 'work_order' NOT NULL,
	"default_priority" "work_order_priority" DEFAULT 'normal' NOT NULL,
	"default_property_id" uuid,
	"default_unit_id" uuid,
	"lead_time_hours" integer DEFAULT 0 NOT NULL,
	"last_fired_at" timestamp with time zone,
	"next_fire_at" timestamp with time zone,
	"times_fired" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_prefs_org_idx" ON "notification_preferences" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_prefs_user_unique" ON "notification_preferences" USING btree ("user_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_prefs_vendor_unique" ON "notification_preferences" USING btree ("vendor_user_id","channel");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_org_idx" ON "notifications" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_recipient_user_idx" ON "notifications" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_recipient_vendor_idx" ON "notifications" USING btree ("recipient_vendor_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_template_fires_org_idx" ON "task_template_fires" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_template_fires_template_idx" ON "task_template_fires" USING btree ("template_id","fire_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_templates_org_idx" ON "task_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_templates_next_fire_idx" ON "task_templates" USING btree ("is_active","next_fire_at");