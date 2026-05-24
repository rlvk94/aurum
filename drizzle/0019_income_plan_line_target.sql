ALTER TABLE "income_plan_line" ADD COLUMN "target" text;--> statement-breakpoint
ALTER TABLE "income_plan_line" ADD COLUMN "target_color" text;--> statement-breakpoint
UPDATE "income_plan_line" l SET "target" = COALESCE(a."name", '') FROM "financial_account" a WHERE l."account_id" = a."id";--> statement-breakpoint
UPDATE "income_plan_line" SET "target" = '' WHERE "target" IS NULL;--> statement-breakpoint
UPDATE "income_plan_line" SET "target_color" = 'gold' WHERE "target_color" IS NULL;--> statement-breakpoint
ALTER TABLE "income_plan_line" ALTER COLUMN "target" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "income_plan_line" ALTER COLUMN "target_color" SET DEFAULT 'gold';--> statement-breakpoint
ALTER TABLE "income_plan_line" ALTER COLUMN "target" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "income_plan_line" ALTER COLUMN "target_color" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "income_plan_line" DROP CONSTRAINT IF EXISTS "income_plan_line_account_id_financial_account_id_fk";--> statement-breakpoint
ALTER TABLE "income_plan_line" DROP COLUMN "account_id";
