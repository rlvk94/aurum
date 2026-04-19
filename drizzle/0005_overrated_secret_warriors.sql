-- Backfill any existing rows with a null name before enforcing NOT NULL.
UPDATE "budget_line" bl
  SET "name" = COALESCE(c."name", 'Linje')
  FROM "category" c
  WHERE bl."name" IS NULL AND bl."category_id" = c."id";--> statement-breakpoint
UPDATE "budget_line" SET "name" = 'Linje' WHERE "name" IS NULL;--> statement-breakpoint
ALTER TABLE "budget_line" ALTER COLUMN "name" SET NOT NULL;
