/**
 * Learned-rule indexing for auto-categorization.
 *
 * Auto-categorization is rules-only: a transaction's derived merchant key
 * (`./merchant-key`) is looked up against the family's learned rules. Rules are
 * built from how the user categorizes their transactions (`./learn`) and
 * seeded with sensible defaults for new families (`db/seeds`). There is no
 * keyword matching — the merchant IS the signal.
 *
 * Pure and dependency-free.
 */

export type LearnedRule = {
  merchantKey: string;
  categoryId: string;
  hitCount: number;
  conflictCount: number;
};

/**
 * Reduce a family's learned rules to a `merchantKey -> categoryId` lookup,
 * picking the winning category per merchant.
 *
 * The winner is the category with the most hits. When two categories are TIED
 * on hits the merchant is ambiguous and omitted entirely — we leave such a
 * transaction uncategorized rather than guess. (conflictCount / id only order
 * the display, they never break a tie into a winner.)
 *
 * Seed rules are stored with `hitCount = 0`, so a single real user
 * categorization (hitCount ≥ 1) always overrides a seed default.
 */
export function indexLearnedRules(rules: LearnedRule[]): Map<string, string> {
  const byKey = new Map<string, LearnedRule[]>();
  for (const rule of rules) {
    const list = byKey.get(rule.merchantKey) ?? [];
    list.push(rule);
    byKey.set(rule.merchantKey, list);
  }

  const out = new Map<string, string>();
  for (const [key, list] of byKey) {
    list.sort(
      (a, b) =>
        b.hitCount - a.hitCount ||
        a.conflictCount - b.conflictCount ||
        (a.categoryId < b.categoryId ? -1 : 1),
    );
    const top = list[0]!;
    const second = list[1];
    if (!second || top.hitCount > second.hitCount) {
      out.set(key, top.categoryId);
    }
  }
  return out;
}

/** Look up the winning category for a transaction's merchant key (or null). */
export function ruleCategoryFor(
  index: Map<string, string>,
  merchantKey: string | null,
): string | null {
  if (!merchantKey) return null;
  return index.get(merchantKey) ?? null;
}
