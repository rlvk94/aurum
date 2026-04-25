CREATE TABLE "announcement_dismissal" (
	"user_id" text NOT NULL,
	"announcement_id" text NOT NULL,
	"dismissed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "announcement_dismissal_user_id_announcement_id_pk" PRIMARY KEY("user_id","announcement_id")
);
--> statement-breakpoint
ALTER TABLE "announcement_dismissal" ADD CONSTRAINT "announcement_dismissal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "last_seen_announcement_id";