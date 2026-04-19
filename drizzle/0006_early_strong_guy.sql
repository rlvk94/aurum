CREATE TABLE "budget_account" (
	"budget_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "budget_account_budget_id_account_id_pk" PRIMARY KEY("budget_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "budget_account" ADD CONSTRAINT "budget_account_budget_id_budget_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budget"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_account" ADD CONSTRAINT "budget_account_account_id_financial_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_account"("id") ON DELETE cascade ON UPDATE no action;