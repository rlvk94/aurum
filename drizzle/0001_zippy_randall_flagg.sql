CREATE TYPE "public"."income_plan_allocation_type" AS ENUM('percentage', 'fixed');--> statement-breakpoint
CREATE TABLE "challenge_account" (
	"challenge_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "challenge_account_challenge_id_account_id_pk" PRIMARY KEY("challenge_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "income_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_plan_income" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_plan_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"account_id" uuid,
	"allocation_type" "income_plan_allocation_type" NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_account" ADD CONSTRAINT "challenge_account_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_account" ADD CONSTRAINT "challenge_account_account_id_financial_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_plan" ADD CONSTRAINT "income_plan_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_plan_income" ADD CONSTRAINT "income_plan_income_plan_id_income_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."income_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_plan_line" ADD CONSTRAINT "income_plan_line_plan_id_income_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."income_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_plan_line" ADD CONSTRAINT "income_plan_line_account_id_financial_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "income_plan_family_idx" ON "income_plan" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "income_plan_income_plan_idx" ON "income_plan_income" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "income_plan_line_plan_idx" ON "income_plan_line" USING btree ("plan_id");