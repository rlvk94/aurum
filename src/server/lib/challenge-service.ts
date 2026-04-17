import "server-only";
import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import type { db as dbInstance } from "~/server/db";
import {
  challenge,
  challengeAccount,
  challengeInstance,
  transaction,
} from "~/server/db/schema";
import {
  computePeriodWindow,
  nextPeriodStart,
} from "~/server/lib/challenge-period";

export type ChallengeRow = typeof challenge.$inferSelect;
export type InstanceRow = typeof challengeInstance.$inferSelect;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Sum of expense transactions for a category in a family across the window,
 * optionally scoped to a subset of accounts. Empty `accountIds` means no
 * account scoping (include all family accounts).
 */
async function sumExpenseInWindow(
  db: typeof dbInstance,
  familyId: string,
  categoryId: string,
  from: string,
  to: string,
  accountIds: string[],
): Promise<number> {
  const conditions = [
    eq(transaction.familyId, familyId),
    eq(transaction.type, "expense"),
    eq(transaction.categoryId, categoryId),
    gte(transaction.date, from),
    lte(transaction.date, to),
  ];
  if (accountIds.length > 0) {
    conditions.push(inArray(transaction.accountId, accountIds));
  }

  const [row] = await db
    .select({
      sum: sql<number>`coalesce(sum(${transaction.amount}), 0)`,
    })
    .from(transaction)
    .where(and(...conditions));
  return Number(row?.sum ?? 0);
}

/** Fetch the set of account IDs this challenge is scoped to (empty = all). */
async function loadChallengeAccountIds(
  db: typeof dbInstance,
  challengeId: string,
): Promise<string[]> {
  const rows = await db
    .select({ accountId: challengeAccount.accountId })
    .from(challengeAccount)
    .where(eq(challengeAccount.challengeId, challengeId));
  return rows.map((r) => r.accountId);
}

/**
 * Net balance change on an account over a window. Computed from transactions:
 *   +income on this account
 *   -expense on this account
 *   -transfer with accountId = this account
 *   +transfer with transferAccountId = this account
 */
async function accountBalanceDelta(
  db: typeof dbInstance,
  familyId: string,
  accountId: string,
  from: string,
  to: string,
): Promise<number> {
  const [row] = await db
    .select({
      delta: sql<number>`coalesce(sum(
        case
          when ${transaction.type} = 'income' and ${transaction.accountId} = ${accountId} then ${transaction.amount}
          when ${transaction.type} = 'expense' and ${transaction.accountId} = ${accountId} then -${transaction.amount}
          when ${transaction.type} = 'transfer' and ${transaction.accountId} = ${accountId} then -${transaction.amount}
          when ${transaction.type} = 'transfer' and ${transaction.transferAccountId} = ${accountId} then ${transaction.amount}
          else 0
        end
      ), 0)`,
    })
    .from(transaction)
    .where(
      and(
        eq(transaction.familyId, familyId),
        gte(transaction.date, from),
        lte(transaction.date, to),
      ),
    );
  return Number(row?.delta ?? 0);
}

export async function computeProgress(
  db: typeof dbInstance,
  row: ChallengeRow,
  instance: InstanceRow,
  asOf: string,
): Promise<number> {
  const effectiveTo = instance.periodEnd < asOf ? instance.periodEnd : asOf;
  if (effectiveTo < instance.periodStart) return 0;
  // If the period hasn't started yet (e.g. a future-dated challenge), no progress.
  if (asOf < instance.periodStart) return 0;

  if (row.type === "spend_less" || row.type === "pay_off_loan") {
    if (!row.categoryId) return 0;
    const accountIds = await loadChallengeAccountIds(db, row.id);
    return sumExpenseInWindow(
      db,
      row.familyId,
      row.categoryId,
      instance.periodStart,
      effectiveTo,
      accountIds,
    );
  }

  if (row.type === "savings") {
    if (!row.accountId) return 0;
    return accountBalanceDelta(
      db,
      row.familyId,
      row.accountId,
      instance.periodStart,
      effectiveTo,
    );
  }

  return 0;
}

export function decideStatus(
  type: ChallengeRow["type"],
  finalAmount: number,
  target: number,
): "completed" | "failed" {
  if (type === "spend_less") {
    return finalAmount <= target ? "completed" : "failed";
  }
  return finalAmount >= target ? "completed" : "failed";
}

/**
 * Closes any ended instance (snapshotting finalAmount + status) and spawns the
 * next period's instance. Repeats until the latest instance covers `today` or
 * the challenge is one-off. Returns the newly-active instance.
 */
export async function rotateChallenge(
  db: typeof dbInstance,
  row: ChallengeRow,
): Promise<InstanceRow | null> {
  if (row.archivedAt) return null;

  let [latest] = await db
    .select()
    .from(challengeInstance)
    .where(eq(challengeInstance.challengeId, row.id))
    .orderBy(sql`${challengeInstance.periodStart} desc`)
    .limit(1);

  if (!latest) {
    const asOf = todayIso();
    const { from, to } = computePeriodWindow(
      row.repetition,
      row.startDate,
      row.endDate,
      row.customDurationDays,
      asOf < row.startDate ? row.startDate : asOf,
    );
    const [created] = await db
      .insert(challengeInstance)
      .values({
        challengeId: row.id,
        periodStart: from,
        periodEnd: to,
      })
      .returning();
    latest = created!;
  }

  if (row.repetition === "one_off") return latest;

  const asOf = todayIso();
  let guard = 0;
  while (latest && latest.periodEnd < asOf && guard < 120) {
    guard++;
    if (latest.status === "active") {
      const finalAmount = await computeProgress(db, row, latest, asOf);
      const status = decideStatus(row.type, finalAmount, row.targetAmount);
      const [updated] = await db
        .update(challengeInstance)
        .set({
          status,
          finalAmount,
          updatedAt: new Date(),
        })
        .where(eq(challengeInstance.id, latest.id))
        .returning();
      latest = updated!;
    }
    const nextStartIso = nextPeriodStart(latest.periodEnd);
    const { from, to } = computePeriodWindow(
      row.repetition,
      row.startDate,
      row.endDate,
      row.customDurationDays,
      nextStartIso,
    );
    const [created] = await db
      .insert(challengeInstance)
      .values({
        challengeId: row.id,
        periodStart: from,
        periodEnd: to,
      })
      .returning();
    latest = created!;
  }

  return latest;
}

/**
 * Rotates every non-archived challenge system-wide. Called by the cron job.
 * Reports per-family counts so operators can sanity-check in logs.
 */
export async function rotateAllChallenges(
  db: typeof dbInstance,
): Promise<{
  processed: number;
  rotated: number;
  errors: { challengeId: string; message: string }[];
}> {
  const rows = await db
    .select()
    .from(challenge)
    .where(isNull(challenge.archivedAt));

  const errors: { challengeId: string; message: string }[] = [];
  let rotated = 0;

  for (const row of rows) {
    try {
      // Count rotations by checking whether the latest instance's periodEnd
      // moved forward after rotation.
      const [beforeLatest] = await db
        .select({ id: challengeInstance.id, periodEnd: challengeInstance.periodEnd })
        .from(challengeInstance)
        .where(eq(challengeInstance.challengeId, row.id))
        .orderBy(sql`${challengeInstance.periodStart} desc`)
        .limit(1);

      const after = await rotateChallenge(db, row);

      if (!beforeLatest || (after && after.id !== beforeLatest.id)) {
        rotated++;
      }
    } catch (err) {
      errors.push({
        challengeId: row.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { processed: rows.length, rotated, errors };
}
