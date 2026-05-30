/**
 * The write side of the self-learning layer: turn a user's categorization
 * decision into (or reinforce) a merchant→category rule.
 *
 * Called from `transaction.update` (a correction) and `transaction.create`
 * (manual entry with a category) and `transaction.applyToSimilar`. Never called
 * from imports or broad bulk updates — those would let a wrong auto-assignment
 * reinforce itself or smear one category across many merchants.
 */

import { and, eq, ne, sql } from "drizzle-orm";

import type { db as dbInstance } from "~/server/db";
import { categorizationRule } from "~/server/db/schema";
import { deriveMerchantKey } from "./merchant-key";

type DbOrTx =
  | typeof dbInstance
  | Parameters<Parameters<typeof dbInstance.transaction>[0]>[0];

export type LearnSource =
  | "user_correction"
  | "user_create"
  | "apply_to_similar";

/**
 * Record that, for `familyId`, this merchant should map to `categoryId`:
 *  - upsert the (family, merchant, category) row, incrementing its hit count;
 *  - bump the conflict count on any OTHER category previously learned for the
 *    same merchant (a drift signal that lets the newer choice overtake a stale
 *    one without deletes).
 *
 * No-op when no merchant key can be derived (transfers, bare reference rows).
 */
export async function learnFromCategorization(
  db: DbOrTx,
  args: {
    familyId: string;
    description: string;
    metadata: Record<string, string> | null;
    categoryId: string;
    source: LearnSource;
  },
): Promise<void> {
  const merchantKey = deriveMerchantKey(args.description, args.metadata);
  if (!merchantKey) return;

  const now = new Date();

  await db
    .insert(categorizationRule)
    .values({
      familyId: args.familyId,
      merchantKey,
      categoryId: args.categoryId,
      source: args.source,
      hitCount: 1,
      lastAppliedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        categorizationRule.familyId,
        categorizationRule.merchantKey,
        categorizationRule.categoryId,
      ],
      set: {
        hitCount: sql`${categorizationRule.hitCount} + 1`,
        lastAppliedAt: now,
        updatedAt: now,
      },
    });

  await db
    .update(categorizationRule)
    .set({
      conflictCount: sql`${categorizationRule.conflictCount} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(categorizationRule.familyId, args.familyId),
        eq(categorizationRule.merchantKey, merchantKey),
        ne(categorizationRule.categoryId, args.categoryId),
      ),
    );
}
