ALTER TYPE "public"."actor_type" ADD VALUE 'tenant';--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "created_by_tenant_user_id" uuid;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "category" text;