CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"emoji" text DEFAULT '📌' NOT NULL,
	"cover_palette" text DEFAULT 'gold' NOT NULL,
	"spending_limit" integer,
	"start_date" date,
	"end_date" date,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_seen_announcement_id" text;--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_family_idx" ON "project" USING btree ("family_id","archived_at");--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transaction_project_idx" ON "transaction" USING btree ("project_id") WHERE "transaction"."project_id" IS NOT NULL;