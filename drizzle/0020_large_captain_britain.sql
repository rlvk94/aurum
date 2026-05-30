CREATE TYPE "public"."categorization_rule_source" AS ENUM('seed', 'user_correction', 'user_create', 'apply_to_similar');--> statement-breakpoint
CREATE TABLE "categorization_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"merchant_key" text NOT NULL,
	"category_id" uuid NOT NULL,
	"hit_count" integer DEFAULT 1 NOT NULL,
	"conflict_count" integer DEFAULT 0 NOT NULL,
	"source" "categorization_rule_source" DEFAULT 'user_correction' NOT NULL,
	"last_applied_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categorization_rule" ADD CONSTRAINT "categorization_rule_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rule" ADD CONSTRAINT "categorization_rule_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categorization_rule_family_merchant_category_idx" ON "categorization_rule" USING btree ("family_id","merchant_key","category_id");--> statement-breakpoint
ALTER TABLE "category" DROP COLUMN "keywords";