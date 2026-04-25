CREATE TABLE "challenge_category" (
	"challenge_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "challenge_category_challenge_id_category_id_pk" PRIMARY KEY("challenge_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "challenge" DROP CONSTRAINT "challenge_category_id_category_id_fk";
--> statement-breakpoint
ALTER TABLE "challenge_category" ADD CONSTRAINT "challenge_category_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_category" ADD CONSTRAINT "challenge_category_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "challenge_category" ("challenge_id", "category_id", "created_at")
  SELECT id, category_id, now() FROM "challenge" WHERE category_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "challenge" DROP COLUMN "category_id";