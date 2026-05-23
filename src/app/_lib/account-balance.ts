// "Visual" balance shown to users in account lists, cards, and detail
// pages. Money reserved in savings goals is subtracted so the user can
// see what's actually available to spend ("out of sight, out of mind").
//
// The underlying financial_account.balance is the source of truth for
// net worth and account reconciliation — it is NOT changed when money
// moves in or out of a savings goal.
export function computeVisualBalance(
  realBalance: number,
  reservedCents: number | undefined | null,
): number {
  return realBalance - (reservedCents ?? 0);
}
