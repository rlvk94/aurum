CREATE TYPE "public"."savings_transfer_mode" AS ENUM('manual', 'monthly_fixed', 'rounding');--> statement-breakpoint
CREATE TYPE "public"."savings_transaction_source" AS ENUM('manual', 'monthly_auto', 'rounding_auto', 'withdraw', 'archive_return');--> statement-breakpoint
CREATE TABLE "savings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '🎯' NOT NULL,
	"color" text DEFAULT 'gold' NOT NULL,
	"target_amount" integer NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"transfer_mode" "savings_transfer_mode" DEFAULT 'manual' NOT NULL,
	"monthly_amount" integer,
	"rounding_step" integer,
	"paused_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"savings_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"source" "savings_transaction_source" NOT NULL,
	"triggering_transaction_id" uuid,
	"note" text,
	"date" date NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "savings" ADD CONSTRAINT "savings_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings" ADD CONSTRAINT "savings_account_id_financial_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_transaction" ADD CONSTRAINT "savings_transaction_savings_id_savings_id_fk" FOREIGN KEY ("savings_id") REFERENCES "public"."savings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_transaction" ADD CONSTRAINT "savings_transaction_account_id_financial_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_transaction" ADD CONSTRAINT "savings_transaction_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_transaction" ADD CONSTRAINT "savings_transaction_triggering_transaction_id_transaction_id_fk" FOREIGN KEY ("triggering_transaction_id") REFERENCES "public"."transaction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "savings_account_idx" ON "savings" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "savings_family_account_idx" ON "savings" USING btree ("family_id","account_id");--> statement-breakpoint
CREATE INDEX "savings_transaction_savings_idx" ON "savings_transaction" USING btree ("savings_id","date" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "savings_transaction_account_idx" ON "savings_transaction" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "savings_transaction_triggering_idx" ON "savings_transaction" USING btree ("triggering_transaction_id") WHERE "savings_transaction"."triggering_transaction_id" IS NOT NULL;