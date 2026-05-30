CREATE TABLE "terms_acceptance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"version" text NOT NULL,
	"locale" "locale" NOT NULL,
	"content_hash" text NOT NULL,
	"content" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "terms_acceptance" ADD CONSTRAINT "terms_acceptance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "terms_acceptance_user_version_uidx" ON "terms_acceptance" USING btree ("user_id","version");--> statement-breakpoint
CREATE INDEX "terms_acceptance_user_idx" ON "terms_acceptance" USING btree ("user_id");