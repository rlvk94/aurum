import "server-only";
import { and, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";

import type { db as dbInstance } from "~/server/db";
import {
  asset,
  challenge,
  challengeAccount,
  challengeCategory,
  challengeInstance,
  debt,
  financialAccount,
  financialAccountAccess,
  transaction,
} from "~/server/db/schema";
import {
  computePeriodWindow,
  nextPeriodStart,
} from "~/server/lib/challenge-period";
import { summarize, type LoanParams } from "~/server/lib/amortization";
import { expandCategoryIds } from "~/server/lib/category-helpers";

export type ChallengeRow = typeof challenge.$inferSelect;
export type InstanceRow = typeof challengeInstance.$inferSelect;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Net spend (expenses minus income) for a set of category ids in a family
 * across the window, optionally scoped to a subset of accounts. Empty
 * `accountIds` means "all shared accounts" — private accounts are excluded so
 * that challenges without explicit scope never leak private-account activity
 * to other members.
 */
async function sumExpenseInWindow(
  db: typeof dbInstance,
  familyId: string,
  categoryIds: string[],
  from: string,
  to: string,
  accountIds: string[],
): Promise<number> {
  if (categoryIds.length === 0) return 0;
  const conditions = [
    eq(transaction.familyId, familyId),
    inArray(transaction.categoryId, categoryIds),
    eq(transaction.excludedFromCalculations, false),
    gte(transaction.date, from),
    lte(transaction.date, to),
  ];
  if (accountIds.length > 0) {
    conditions.push(inArray(transaction.accountId, accountIds));
  } else {
    const sharedRows = await db
      .select({ id: financialAccount.id })
      .from(financialAccount)
      .where(
        and(
          eq(financialAccount.familyId, familyId),
          eq(financialAccount.visibility, "shared"),
        ),
      );
    if (sharedRows.length === 0) return 0;
    conditions.push(
      inArray(
        transaction.accountId,
        sharedRows.map((r) => r.id),
      ),
    );
  }

  const [row] = await db
    .select({
      sum: sql<number>`coalesce(sum(case when ${transaction.type} = 'expense' then ${transaction.amount} when ${transaction.type} = 'income' then -${transaction.amount} else 0 end), 0)`,
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

/** Fetch the set of category IDs this challenge targets. */
async function loadChallengeCategoryIds(
  db: typeof dbInstance,
  challengeId: string,
): Promise<string[]> {
  const rows = await db
    .select({ categoryId: challengeCategory.categoryId })
    .from(challengeCategory)
    .where(eq(challengeCategory.challengeId, challengeId));
  return rows.map((r) => r.categoryId);
}

/**
 * Net balance change on an account over a window. Computed from transactions:
 *   +income on this account
 *   -expense on this account
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
          else 0
        end
      ), 0)`,
    })
    .from(transaction)
    .where(
      and(
        eq(transaction.familyId, familyId),
        eq(transaction.excludedFromCalculations, false),
        gte(transaction.date, from),
        lte(transaction.date, to),
      ),
    );
  return Number(row?.delta ?? 0);
}

/**
 * Snapshot of a viewer's net worth view:
 *   sum(accessible accounts.balance where includeInNetWorth) + sum(assets.value) − sum(debt outstanding)
 *
 * When `viewerId` is set, accounts are filtered to the viewer's accessible set
 * (shared + any private accounts explicitly granted). This prevents a
 * net_worth_goal challenge — which is visible to every family member — from
 * leaking another member's private balances, while still letting a user with
 * access to a private account count it toward their progress.
 *
 * When `viewerId` is omitted (cron rotation snapshot), every non-archived
 * account counts — the stored `finalAmount` reflects the full family position.
 */
async function computeFamilyNetWorth(
  db: typeof dbInstance,
  familyId: string,
  asOf: string,
  viewerId?: string,
): Promise<number> {
  const accountConditions = [
    eq(financialAccount.familyId, familyId),
    eq(financialAccount.archived, false),
  ];

  if (viewerId) {
    const accessRows = await db
      .select({ accountId: financialAccountAccess.accountId })
      .from(financialAccountAccess)
      .where(eq(financialAccountAccess.userId, viewerId));
    const grantedIds = accessRows.map((r) => r.accountId);
    accountConditions.push(
      grantedIds.length > 0
        ? or(
            eq(financialAccount.visibility, "shared"),
            inArray(financialAccount.id, grantedIds),
          )!
        : eq(financialAccount.visibility, "shared"),
    );
  }

  const [accountRow] = await db
    .select({
      balance: sql<number>`coalesce(sum(case when ${financialAccount.includeInNetWorth} then ${financialAccount.balance} else 0 end), 0)`,
    })
    .from(financialAccount)
    .where(and(...accountConditions));

  const [assetRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${asset.value}), 0)`,
    })
    .from(asset)
    .where(and(eq(asset.familyId, familyId), eq(asset.archived, false)));

  const debtRows = await db
    .select({
      principal: debt.principal,
      interestRateBps: debt.interestRateBps,
      startDate: debt.startDate,
      termMonths: debt.termMonths,
      paymentFrequency: debt.paymentFrequency,
    })
    .from(debt)
    .where(and(eq(debt.familyId, familyId), isNull(debt.archivedAt)));

  let totalDebt = 0;
  for (const row of debtRows) {
    const params: LoanParams = {
      principal: row.principal,
      interestRateBps: row.interestRateBps,
      termMonths: row.termMonths,
      paymentFrequency: row.paymentFrequency,
    };
    totalDebt += summarize(params, row.startDate, asOf).outstandingBalance;
  }

  return (
    Number(accountRow?.balance ?? 0) + Number(assetRow?.total ?? 0) - totalDebt
  );
}

export async function computeProgress(
  db: typeof dbInstance,
  row: ChallengeRow,
  instance: InstanceRow,
  asOf: string,
  opts: { viewerId?: string } = {},
): Promise<number> {
  if (row.type === "net_worth_goal") {
    return computeFamilyNetWorth(db, row.familyId, asOf, opts.viewerId);
  }

  const effectiveTo = instance.periodEnd < asOf ? instance.periodEnd : asOf;
  if (effectiveTo < instance.periodStart) return 0;
  // If the period hasn't started yet (e.g. a future-dated challenge), no progress.
  if (asOf < instance.periodStart) return 0;

  if (row.type === "spend_less" || row.type === "pay_off_loan") {
    const categoryIds = await loadChallengeCategoryIds(db, row.id);
    if (categoryIds.length === 0) return 0;
    const accountIds = await loadChallengeAccountIds(db, row.id);
    const expanded = await expandCategoryIds(db, row.familyId, categoryIds);
    if (expanded.length === 0) return 0;
    return sumExpenseInWindow(
      db,
      row.familyId,
      expanded,
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
export async function rotateAllChallenges(db: typeof dbInstance): Promise<{
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
        .select({
          id: challengeInstance.id,
          periodEnd: challengeInstance.periodEnd,
        })
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

/**
 * Recompute the snapshotted `finalAmount` + `status` for any closed challenge
 * instance whose window contains one of the supplied transaction dates. Call
 * this after transactions are inserted, updated, or deleted so that past-period
 * history reflects the latest data instead of frozen-at-rotation values. Active
 * instances are skipped (their progress is computed live on read).
 */
export async function refreshChallengeSnapshotsForFamily(
  db: typeof dbInstance,
  familyId: string,
  affectedDates: string[],
): Promise<void> {
  if (affectedDates.length === 0) return;
  const uniqueDates = Array.from(new Set(affectedDates.filter(Boolean)));
  if (uniqueDates.length === 0) return;
  const minDate = uniqueDates.reduce((a, b) => (a < b ? a : b));
  const maxDate = uniqueDates.reduce((a, b) => (a > b ? a : b));

  const rows = await db
    .select()
    .from(challenge)
    .where(and(eq(challenge.familyId, familyId), isNull(challenge.archivedAt)));

  const asOf = todayIso();

  for (const row of rows) {
    const instances = await db
      .select()
      .from(challengeInstance)
      .where(
        and(
          eq(challengeInstance.challengeId, row.id),
          ne(challengeInstance.status, "active"),
          lte(challengeInstance.periodStart, maxDate),
          gte(challengeInstance.periodEnd, minDate),
        ),
      );

    for (const inst of instances) {
      const hit = uniqueDates.some(
        (d) => d >= inst.periodStart && d <= inst.periodEnd,
      );
      if (!hit) continue;
      const finalAmount = await computeProgress(db, row, inst, asOf);
      const status = decideStatus(row.type, finalAmount, row.targetAmount);
      await db
        .update(challengeInstance)
        .set({ finalAmount, status, updatedAt: new Date() })
        .where(eq(challengeInstance.id, inst.id));
    }
  }
}
