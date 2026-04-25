-- Rename family_plan enum values: free → individual, pro → family.
-- Default constraint must be dropped/recreated because Postgres records the
-- default with the original enum-value identifier.
ALTER TABLE "family_subscription" ALTER COLUMN "plan" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."family_plan" RENAME VALUE 'free' TO 'individual';--> statement-breakpoint
ALTER TYPE "public"."family_plan" RENAME VALUE 'pro' TO 'family';--> statement-breakpoint
ALTER TABLE "family_subscription" ALTER COLUMN "plan" SET DEFAULT 'individual';
