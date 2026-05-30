/**
 * One-off backfill: re-run the bank-text sanitizer over EXISTING transaction
 * descriptions so older/weaker sanitization gets cleaned up to current rules.
 *
 * Categories are NEVER touched — only `description` (and, when it changes, the
 * preserved-original `metadata.rawDescription`).
 *
 * Scope & safety:
 *  - Only IMPORTED rows (`imported_at IS NOT NULL`). Manually typed transactions
 *    are left exactly as the user entered them.
 *  - The true original is re-derived from `metadata.rawDescription` when present
 *    (imports preserve it there), otherwise from the current `description`.
 *  - When sanitizing changes the text, the original is (re)written to
 *    `metadata.rawDescription`, so nothing is lost and re-runs are idempotent.
 *  - DRY-RUN by default: prints a diff summary and writes NOTHING. Pass --apply
 *    to commit.
 *
 * This is a data backfill (sanitizer is JS logic, not expressible in SQL), so it
 * is a standalone script — NOT a Drizzle migration and NOT part of the prod
 * auto-migrate pipeline. Run it manually, pointing at whichever database:
 *
 *   DATABASE_URL=... npx tsx scripts/resanitize-descriptions.ts            # preview
 *   DATABASE_URL=... npx tsx scripts/resanitize-descriptions.ts --apply    # write
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, isNotNull } from "drizzle-orm";
import postgres from "postgres";

import { sanitizeBankText } from "~/server/categorization/sanitize";
import { transaction } from "~/server/db/schema/transaction";

const APPLY = process.argv.includes("--apply");
const SAMPLE_LIMIT = 40;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);

  try {
    const rows = await db
      .select({
        id: transaction.id,
        description: transaction.description,
        metadata: transaction.metadata,
      })
      .from(transaction)
      .where(isNotNull(transaction.importedAt));

    let changed = 0;
    const samples: { before: string; after: string }[] = [];

    for (const row of rows) {
      const meta = row.metadata ?? {};
      // Sanitize from the true original when we kept it, else from what we have.
      const raw = meta.rawDescription ?? row.description;
      const clean = sanitizeBankText(raw) || raw;
      if (clean === row.description) continue;

      changed++;
      if (samples.length < SAMPLE_LIMIT) {
        samples.push({ before: row.description, after: clean });
      }

      if (APPLY) {
        // Preserve the original so nothing is lost and re-runs are idempotent.
        const nextMeta: Record<string, string> =
          raw !== clean ? { ...meta, rawDescription: raw } : meta;
        await db
          .update(transaction)
          .set({
            description: clean,
            metadata: nextMeta,
            updatedAt: new Date(),
          })
          .where(eq(transaction.id, row.id));
      }
    }

    console.log(`\nMode:           ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}`);
    console.log(`Imported rows:  ${rows.length}`);
    console.log(`Would change:   ${changed}`);
    console.log(`Unchanged:      ${rows.length - changed}\n`);

    if (samples.length > 0) {
      console.log(`Sample diffs (first ${samples.length}):`);
      for (const s of samples) {
        console.log(`  - ${JSON.stringify(s.before)}  ->  ${JSON.stringify(s.after)}`);
      }
      console.log("");
    }

    if (!APPLY && changed > 0) {
      console.log("Re-run with --apply to write these changes.\n");
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
