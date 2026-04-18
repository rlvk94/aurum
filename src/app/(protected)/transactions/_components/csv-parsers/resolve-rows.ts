import type { ParsedTransaction } from "./types";
import { normalizeAccountNumber } from "./utils";

export type ImportableRow = {
  accountId: string;
  type: "expense" | "income" | "transfer";
  amount: number;
  date: string;
  description: string;
  note?: string;
  metadata?: Record<string, string>;
  externalId: string;
  transferAccountId?: string;
};

export type ResolveResult = {
  matched: ImportableRow[];
  skipped: number;
  mirroredSkipped: number;
  matchedAccountIds: Set<string>;
};

/**
 * Resolve each row into an account-scoped import record.
 *
 * Handles the "mirror-row" case in dual-account bank CSVs: when the same
 * transfer between two family accounts appears twice in the export (once as
 * an outgoing row on the source account, with both from + to populated; and
 * once as an incoming row on the destination account, with sender empty),
 * we keep the outgoing `transfer` and drop the incoming mirror so the
 * destination is not credited twice.
 */
export function resolveRows(
  rows: ParsedTransaction[],
  accountIdByIdentifier: Map<string, string>,
): ResolveResult {
  type Resolved = ImportableRow & { counterPresent: boolean };

  const resolved: Resolved[] = [];
  const matchedAccountIds = new Set<string>();
  let skipped = 0;

  for (const row of rows) {
    const exportCanonical = normalizeAccountNumber(row.exportAccount);
    const accountId = accountIdByIdentifier.get(exportCanonical);
    if (!accountId) {
      skipped++;
      continue;
    }
    matchedAccountIds.add(accountId);

    const counterCanonical = normalizeAccountNumber(row.counterAccount);
    const candidateTransferId = counterCanonical
      ? accountIdByIdentifier.get(counterCanonical)
      : undefined;
    const transferAccountId =
      candidateTransferId && candidateTransferId !== accountId
        ? candidateTransferId
        : undefined;

    const type: "expense" | "income" | "transfer" = transferAccountId
      ? "transfer"
      : row.direction === "outgoing"
        ? "expense"
        : "income";

    resolved.push({
      accountId,
      type,
      amount: Math.abs(row.amount),
      date: row.date,
      description: row.description || "—",
      note: row.note || undefined,
      metadata:
        Object.keys(row.metadata).length > 0 ? row.metadata : undefined,
      externalId: `${row.date}:${row.amount}:${row.balance}`,
      transferAccountId,
      counterPresent: Boolean(counterCanonical),
    });
  }

  const transferConsumed = new Array<boolean>(resolved.length).fill(false);
  const mirrorExcluded = new Set<number>();

  for (let i = 0; i < resolved.length; i++) {
    const candidate = resolved[i]!;
    if (candidate.type !== "income" || candidate.counterPresent) continue;

    for (let j = 0; j < resolved.length; j++) {
      if (transferConsumed[j]) continue;
      const other = resolved[j]!;
      if (
        other.type === "transfer" &&
        other.transferAccountId === candidate.accountId &&
        other.date === candidate.date &&
        other.amount === candidate.amount
      ) {
        transferConsumed[j] = true;
        mirrorExcluded.add(i);
        break;
      }
    }
  }

  const matched: ImportableRow[] = [];
  for (let i = 0; i < resolved.length; i++) {
    if (mirrorExcluded.has(i)) continue;
    const entry = resolved[i]!;
    const { counterPresent: _counterPresent, ...row } = entry;
    matched.push(row);
  }

  return {
    matched,
    skipped,
    mirroredSkipped: mirrorExcluded.size,
    matchedAccountIds,
  };
}
