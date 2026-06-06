// Pure validation for splitting one transaction into ≥2 child parts.
// Kept side-effect free so it can be unit-tested without a database; the
// tRPC router layers family-scoping, leaf-category checks, and persistence
// on top of these rules.

export type SplitPartAmounts = { amount: number };

export type SplitValidationError =
  | "too_few_parts"
  | "non_positive_amount"
  | "non_integer_amount"
  | "sum_mismatch";

export type SplitValidationResult =
  | { ok: true }
  | { ok: false; reason: SplitValidationError };

/**
 * A split is valid when there are at least two parts, every part is a
 * positive integer (cents), and the parts sum exactly to the original
 * amount. Exact summation is what keeps the account balance and net worth
 * invariant — there is no rounding step anywhere in the split path.
 */
export function validateSplitParts(
  originalAmount: number,
  parts: SplitPartAmounts[],
): SplitValidationResult {
  if (parts.length < 2) return { ok: false, reason: "too_few_parts" };

  let sum = 0;
  for (const part of parts) {
    if (!Number.isInteger(part.amount)) {
      return { ok: false, reason: "non_integer_amount" };
    }
    if (part.amount <= 0) {
      return { ok: false, reason: "non_positive_amount" };
    }
    sum += part.amount;
  }

  if (sum !== originalAmount) return { ok: false, reason: "sum_mismatch" };
  return { ok: true };
}

export type SplittableOriginal = {
  transferGroupId: string | null;
  splitParentId: string | null;
};

export type SplittableError = "is_transfer" | "is_part";

/**
 * Guard the original transaction itself: a transfer leg cannot be split
 * (transfers are not spending), and a part cannot be split again (no nested
 * splits). Whether the original is *already* split is detected separately by
 * checking for existing child rows.
 */
export function checkSplittableOriginal(
  original: SplittableOriginal,
): { ok: true } | { ok: false; reason: SplittableError } {
  if (original.transferGroupId) return { ok: false, reason: "is_transfer" };
  if (original.splitParentId) return { ok: false, reason: "is_part" };
  return { ok: true };
}
