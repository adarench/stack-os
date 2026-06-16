ALTER TABLE "work_orders" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "acknowledged_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "tenant_updated_at" timestamp with time zone;