ALTER TABLE "financial_account" ADD COLUMN "opening_balance" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Backfill: existing `balance` was set at account creation and never updated by
-- transactions, so it is effectively the opening balance. Copy it across, then
-- recompute `balance` to include all subsequent transaction activity.
UPDATE "financial_account" SET "opening_balance" = "balance";
--> statement-breakpoint
UPDATE "financial_account" AS fa
SET "balance" = fa."opening_balance" + COALESCE((
  SELECT SUM(
    CASE
      WHEN t."type" = 'income' THEN t."amount"
      WHEN t."type" = 'expense' THEN -t."amount"
      ELSE 0
    END
  )
  FROM "transaction" AS t
  WHERE t."account_id" = fa."id"
), 0);