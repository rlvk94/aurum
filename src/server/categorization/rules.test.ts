import { describe, expect, it } from "vitest";

import { indexLearnedRules, ruleCategoryFor, type LearnedRule } from "./rules";

function rule(
  merchantKey: string,
  categoryId: string,
  hitCount = 1,
  conflictCount = 0,
): LearnedRule {
  return { merchantKey, categoryId, hitCount, conflictCount };
}

describe("indexLearnedRules", () => {
  it("maps a merchant to its only learned category", () => {
    const idx = indexLearnedRules([rule("netto", "groceries")]);
    expect(idx.get("netto")).toBe("groceries");
  });

  it("picks the category with the most hits", () => {
    const idx = indexLearnedRules([
      rule("netto", "groceries", 5),
      rule("netto", "other", 1),
    ]);
    expect(idx.get("netto")).toBe("groceries");
  });

  it("omits a merchant whose top categories are tied (ambiguous)", () => {
    const idx = indexLearnedRules([
      rule("netto", "groceries", 2),
      rule("netto", "other", 2),
    ]);
    expect(idx.has("netto")).toBe(false);
  });

  it("lets a single user hit override a seed default (hitCount 0)", () => {
    const idx = indexLearnedRules([
      rule("netto", "seed-cat", 0),
      rule("netto", "user-cat", 1),
    ]);
    expect(idx.get("netto")).toBe("user-cat");
  });

  it("applies a lone seed rule (hitCount 0) for cold-start", () => {
    const idx = indexLearnedRules([rule("netto", "seed-cat", 0)]);
    expect(idx.get("netto")).toBe("seed-cat");
  });
});

describe("ruleCategoryFor", () => {
  const idx = indexLearnedRules([rule("netto", "groceries", 2)]);

  it("returns the category for a known merchant", () => {
    expect(ruleCategoryFor(idx, "netto")).toBe("groceries");
  });

  it("returns null for an unknown merchant", () => {
    expect(ruleCategoryFor(idx, "ukendt")).toBeNull();
  });

  it("returns null when no merchant key derived", () => {
    expect(ruleCategoryFor(idx, null)).toBeNull();
  });
});
