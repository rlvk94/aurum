ALTER TABLE "transaction" DROP CONSTRAINT "transaction_transfer_account_id_financial_account_id_fk";
--> statement-breakpoint
DELETE FROM "transaction" WHERE "type" = 'transfer';--> statement-breakpoint
ALTER TABLE "transaction" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."transaction_type";--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('expense', 'income');--> statement-breakpoint
ALTER TABLE "transaction" ALTER COLUMN "type" SET DATA TYPE "public"."transaction_type" USING "type"::"public"."transaction_type";--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "transfer_group_id" uuid;--> statement-breakpoint
CREATE INDEX "transaction_transfer_group_idx" ON "transaction" USING btree ("transfer_group_id") WHERE "transaction"."transfer_group_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction" DROP COLUMN "transfer_account_id";