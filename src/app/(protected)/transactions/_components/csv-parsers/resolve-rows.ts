import type { ParsedTransaction } from "./types";
import { normalizeAccountNumber } from "./utils";

export type ImportableRow = {
  accountId: string;
  type: "expense" | "income";
  amount: number;
  date: string;
  description: string;
  note?: string;
  metadata?: Record<string, string>;
  externalId: string;
  transferGroupId?: string;
};

export type ResolveResult = {
  matched: ImportableRow[];
  skipped: number;
  matchedAccountIds: Set<string>;
};

/**
 * Resolve each row into an account-scoped import record.
 *
 * Dual-account bank exports list internal transfers twice — once as an
 * outgoing row on the source account and once as an incoming row on the
 * destination account. Both halves are kept (each is a real per-account
 * event) and stamped with a shared `transferGroupId` so the UI can render
 * them as linked.
 */
export function resolveRows(
  rows: ParsedTransaction[],
  accountIdByIdentifier: Map<string, string>,
): ResolveResult {
  type Resolved = ImportableRow & {
    counterPresent: boolean;
    counterAccountId?: string;
  };

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
    const candidateCounterId = counterCanonical
      ? accountIdByIdentifier.get(counterCanonical)
      : undefined;
    const counterAccountId =
      candidateCounterId && candidateCounterId !== accountId
        ? candidateCounterId
        : undefined;

    const type: "expense" | "income" =
      row.direction === "outgoing" ? "expense" : "income";

    resolved.push({
      accountId,
      type,
      amount: Math.abs(row.amount),
      date: row.date,
      description: row.description || "—",
      note: row.note || undefined,
      metadata:
        Object.keys(row.metadata).length > 0 ? row.metadata : undefined,
      externalId: row.externalId ?? `${row.date}:${row.amount}:${row.balance}`,
      counterPresent: Boolean(counterCanonical),
      counterAccountId,
    });
  }

  // Pair outgoing rows with their incoming mirror on the partner account so
  // both halves share a transferGroupId. We only generate a group when the
  // mirror is actually present in the import — a one-sided transfer stays
  // unlinked.
  const claimed = new Array<boolean>(resolved.length).fill(false);
  for (let i = 0; i < resolved.length; i++) {
    if (claimed[i]) continue;
    const out = resolved[i]!;
    if (out.type !== "expense" || !out.counterAccountId) continue;

    for (let j = 0; j < resolved.length; j++) {
      if (i === j || claimed[j]) continue;
      const inc = resolved[j]!;
      if (
        inc.type === "income" &&
        inc.accountId === out.counterAccountId &&
        inc.date === out.date &&
        inc.amount === out.amount
      ) {
        const groupId = crypto.randomUUID();
        out.transferGroupId = groupId;
        inc.transferGroupId = groupId;
        claimed[i] = true;
        claimed[j] = true;
        break;
      }
    }
  }

  const matched: ImportableRow[] = resolved.map((r) => {
    const {
      counterPresent: _counterPresent,
      counterAccountId: _counterAccountId,
      ...row
    } = r;
    return row;
  });

  return {
    matched,
    skipped,
    matchedAccountIds,
  };
}
