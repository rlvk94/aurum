CREATE TABLE "consumption_meter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"unit" text NOT NULL,
	"decimals" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumption_reading" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meter_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"date" date NOT NULL,
	"value" bigint NOT NULL,
	"is_meter_reset" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumption_settings" (
	"family_id" uuid PRIMARY KEY NOT NULL,
	"reminder_enabled" boolean DEFAULT false NOT NULL,
	"reminder_cadence" text DEFAULT 'monthly' NOT NULL,
	"reminder_day_of_month" integer DEFAULT 1 NOT NULL,
	"reminder_weekday" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consumption_meter" ADD CONSTRAINT "consumption_meter_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_reading" ADD CONSTRAINT "consumption_reading_meter_id_consumption_meter_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."consumption_meter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_reading" ADD CONSTRAINT "consumption_reading_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumption_settings" ADD CONSTRAINT "consumption_settings_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consumption_meter_family_idx" ON "consumption_meter" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consumption_reading_meter_date_idx" ON "consumption_reading" USING btree ("meter_id","date");--> statement-breakpoint
CREATE INDEX "consumption_reading_family_date_idx" ON "consumption_reading" USING btree ("family_id","date");