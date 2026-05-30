import type { db as dbInstance } from "~/server/db";
import { categorizationRule, category } from "~/server/db/schema";
import type { Locale } from "~/i18n/config";
import { deriveMerchantKey } from "~/server/categorization";
import { defaultCategories } from "./default-categories";

type Transaction = Parameters<
  Parameters<typeof dbInstance.transaction>[0]
>[0];

/** merchantKey -> set of candidate leaf category ids. */
type RuleTargets = Map<string, Set<string>>;

function addLeafTerms(
  targets: RuleTargets,
  categoryId: string,
  terms: string[] | undefined,
) {
  for (const term of terms ?? []) {
    const key = deriveMerchantKey(term);
    if (!key) continue;
    const set = targets.get(key) ?? new Set<string>();
    set.add(categoryId);
    targets.set(key, set);
  }
}

/**
 * Default seed rules for a family, from accumulated merchant terms. Only keys
 * that map to exactly ONE leaf are seeded — ambiguous terms are dropped rather
 * than guessed. `hitCount 0` marks them as seeds, so a single real user
 * categorization always overrides them.
 */
function buildSeedRuleValues(familyId: string, targets: RuleTargets) {
  const values = [];
  for (const [merchantKey, categoryIds] of targets) {
    if (categoryIds.size !== 1) continue;
    values.push({
      familyId,
      merchantKey,
      categoryId: [...categoryIds][0]!,
      hitCount: 0,
      source: "seed" as const,
    });
  }
  return values;
}

/** Map each default leaf's da & en name to its seed merchant terms. */
function defaultSeedTermsByName(): Map<string, string[]> {
  const byName = new Map<string, string[]>();
  for (const parent of defaultCategories) {
    for (const child of parent.children ?? []) {
      if (!child.keywords?.length) continue;
      byName.set(child.name.da, child.keywords);
      byName.set(child.name.en, child.keywords);
    }
  }
  return byName;
}

export async function seedDefaultCategories(
  tx: Transaction,
  familyId: string,
  locale: Locale,
) {
  const targets: RuleTargets = new Map();

  for (const parent of defaultCategories) {
    const [parentRow] = await tx
      .insert(category)
      .values({
        familyId,
        name: parent.name[locale],
        icon: parent.icon,
      })
      .returning({ id: category.id });

    if (!parentRow || !parent.children?.length) continue;

    const childRows = await tx
      .insert(category)
      .values(
        parent.children.map((child) => ({
          familyId,
          parentId: parentRow.id,
          name: child.name[locale],
          icon: child.icon,
        })),
      )
      .returning({ id: category.id, name: category.name });

    // Match returned rows to seed children by name (unique within a parent).
    const idByName = new Map(childRows.map((r) => [r.name, r.id]));
    for (const child of parent.children) {
      const id = idByName.get(child.name[locale]);
      if (id) addLeafTerms(targets, id, child.keywords);
    }
  }

  const ruleValues = buildSeedRuleValues(familyId, targets);
  if (ruleValues.length > 0) {
    await tx.insert(categorizationRule).values(ruleValues);
  }
}

/**
 * Re-seed default rules onto a family's EXISTING leaf categories (matched by
 * name). Used by the "reset rules" action. Returns the number of rules created.
 * The caller is responsible for deleting the family's prior rules first.
 */
export async function reseedRulesForCategories(
  tx: Transaction,
  familyId: string,
  leaves: { id: string; name: string }[],
): Promise<number> {
  const termsByName = defaultSeedTermsByName();
  const targets: RuleTargets = new Map();
  for (const leaf of leaves) {
    addLeafTerms(targets, leaf.id, termsByName.get(leaf.name));
  }
  const ruleValues = buildSeedRuleValues(familyId, targets);
  if (ruleValues.length > 0) {
    await tx.insert(categorizationRule).values(ruleValues);
  }
  return ruleValues.length;
}
