ALTER TABLE "tenant_users" ADD COLUMN "password_reset_token_hash" text;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN "password_reset_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_token_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;