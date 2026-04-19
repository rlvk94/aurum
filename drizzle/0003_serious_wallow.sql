CREATE TYPE "public"."budget_recurrence" AS ENUM('monthly', 'quarterly', 'semi_annual', 'annual', 'custom');--> statement-breakpoint
CREATE TABLE "budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"category_id" uuid,
	"recurrence" "budget_recurrence" NOT NULL,
	"amounts" jsonb DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget" ADD CONSTRAINT "budget_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_line" ADD CONSTRAINT "budget_line_budget_id_budget_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budget"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_line" ADD CONSTRAINT "budget_line_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_family_year_idx" ON "budget" USING btree ("family_id","year");--> statement-breakpoint
CREATE INDEX "budget_line_budget_idx" ON "budget_line" USING btree ("budget_id");