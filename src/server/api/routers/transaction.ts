import { z } from "zod";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  checkSplittableOriginal,
  validateSplitParts,
} from "~/server/lib/split-helpers";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { type db as dbInstance } from "~/server/db";
import {
  financialAccount,
  financialAccountAccess,
  savings,
  savingsTransaction,
  transaction,
  user,
} from "~/server/db/schema";
import { applySavingsMovement } from "./savings";
import { getPostHogClient } from "~/server/posthog";
import { loadLearnedRules } from "./category";
import {
  deriveMerchantKey,
  indexLearnedRules,
  ruleCategoryFor,
  sanitizeBankText,
} from "~/server/categorization";
import { learnFromCategorization } from "~/server/categorization/learn";
import {
  assertCategoryIsLeaf,
  expandCategoryIds,
} from "~/server/lib/category-helpers";
import { refreshChallengeSnapshotsForFamily } from "~/server/lib/challenge-service";

// Postgres TEXT columns reject null bytes with
// "unsupported Unicode escape sequence". CSV data from banks sometimes
// contains stray \u0000, so strip them before insert.
function stripNullBytes(value: string): string {
  return value.replace(/\u0000/g, "");
}

function sanitizeMetadata(
  meta: Record<string, string> | undefined,
): Record<string, string> | null {
  if (!meta) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[stripNullBytes(k)] = stripNullBytes(v);
  }
  return out;
}

const transactionTypeSchema = z.enum(["expense", "income"]);

async function getActiveFamilyId(db: typeof dbInstance, userId: string) {
  const [dbUser] = await db
    .select({ activeFamilyId: user.activeFamilyId })
    .from(user)
    .where(eq(user.id, userId));

  if (!dbUser?.activeFamilyId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active family",
    });
  }
  return dbUser.activeFamilyId;
}

/**
 * Returns IDs of accounts in the family that the user has access to.
 * Used to scope transaction queries.
 */
async function getAccessibleAccountIds(
  db: typeof dbInstance,
  familyId: string,
  userId: string,
) {
  const accessRows = await db
    .select({ accountId: financialAccountAccess.accountId })
    .from(financialAccountAccess)
    .where(eq(financialAccountAccess.userId, userId));

  const privateIds = accessRows.map((r) => r.accountId);

  const accounts = await db
    .select({ id: financialAccount.id })
    .from(financialAccount)
    .where(
      and(
        eq(financialAccount.familyId, familyId),
        or(
          eq(financialAccount.visibility, "shared"),
          privateIds.length > 0
            ? inArray(financialAccount.id, privateIds)
            : undefined,
        ),
      ),
    );

  return accounts.map((a) => a.id);
}

async function assertAccountAccess(
  db: typeof dbInstance,
  familyId: string,
  userId: string,
  accountIds: string[],
) {
  if (accountIds.length === 0) return;
  const allowed = await getAccessibleAccountIds(db, familyId, userId);
  const allowedSet = new Set(allowed);
  for (const id of accountIds) {
    if (!allowedSet.has(id)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No access to this account",
      });
    }
  }
}

function signedDelta(type: "income" | "expense", amount: number): number {
  return type === "income" ? amount : -amount;
}

type SplitOriginal = {
  id: string;
  accountId: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  description: string;
  transferGroupId: string | null;
  splitParentId: string | null;
};

/** Load a family-scoped original and assert the caller can access its account. */
async function loadSplitOriginal(
  db: typeof dbInstance,
  familyId: string,
  userId: string,
  transactionId: string,
): Promise<SplitOriginal> {
  const [original] = await db
    .select({
      id: transaction.id,
      accountId: transaction.accountId,
      type: transaction.type,
      amount: transaction.amount,
      date: transaction.date,
      description: transaction.description,
      transferGroupId: transaction.transferGroupId,
      splitParentId: transaction.splitParentId,
    })
    .from(transaction)
    .where(
      and(
        eq(transaction.id, transactionId),
        eq(transaction.familyId, familyId),
      ),
    );

  if (!original) throw new TRPCError({ code: "NOT_FOUND" });
  await assertAccountAccess(db, familyId, userId, [original.accountId]);
  return original;
}

async function hasSplitParts(
  db: typeof dbInstance,
  originalId: string,
): Promise<boolean> {
  const [child] = await db
    .select({ id: transaction.id })
    .from(transaction)
    .where(eq(transaction.splitParentId, originalId))
    .limit(1);
  return Boolean(child);
}

/** Throw a typed BAD_REQUEST if the parts don't sum to the original exactly. */
function assertSplitSum(
  originalAmount: number,
  parts: { amount: number }[],
): void {
  const result = validateSplitParts(originalAmount, parts);
  if (result.ok) return;
  const message =
    result.reason === "too_few_parts"
      ? "A split needs at least two parts"
      : result.reason === "sum_mismatch"
        ? "Parts must sum to the original amount"
        : "Each part amount must be a positive whole number";
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

async function assertPartCategoriesLeaf(
  db: typeof dbInstance,
  familyId: string,
  parts: { categoryId?: string }[],
): Promise<void> {
  for (const part of parts) {
    if (part.categoryId) {
      await assertCategoryIsLeaf(db, familyId, part.categoryId);
    }
  }
}

type DbOrTx =
  | Parameters<Parameters<typeof dbInstance.transaction>[0]>[0]
  | typeof dbInstance;

/**
 * Apply rounding-mode savings auto-transfers for an expense. Runs after
 * the parent transaction has been inserted and the account balance
 * adjusted. Splits the round-up delta equally across all active rounding
 * savings on the account (remainder cents → earliest by createdAt).
 *
 * Income, transfers (rows with transferGroupId), and expenses that
 * already produce a zero delta short-circuit without any savings work.
 *
 * The parent account's real balance is NOT touched here — savings
 * reservations only affect the visual balance (computed as
 * account.balance − sum(savings on that account)).
 */
async function applyRoundingForExpense(
  tx: DbOrTx,
  args: {
    familyId: string;
    accountId: string;
    transactionId: string;
    amount: number;
    date: string;
    transferGroupId?: string | null;
  },
): Promise<void> {
  if (args.transferGroupId) return;

  const recipients = await tx
    .select({
      id: savings.id,
      accountId: savings.accountId,
      roundingStep: savings.roundingStep,
    })
    .from(savings)
    .where(
      and(
        eq(savings.accountId, args.accountId),
        eq(savings.transferMode, "rounding"),
        eq(savings.archived, false),
        isNull(savings.pausedAt),
      ),
    )
    .orderBy(savings.createdAt);

  if (recipients.length === 0) return;

  // All rounding savings on a single account share the same step today
  // (the dialog enforces this implicitly per savings). Use each savings'
  // own step so future per-savings tuning still works; for split
  // semantics we use the FIRST recipient's step as the canonical one
  // (the others contribute by sharing the delta).
  const step = recipients[0]?.roundingStep ?? 0;
  if (step <= 0) return;

  const rounded = Math.ceil(args.amount / step) * step;
  const delta = rounded - args.amount;
  if (delta <= 0) return;

  const perRecipient = Math.floor(delta / recipients.length);
  let remainder = delta - perRecipient * recipients.length;

  for (const r of recipients) {
    const portion = perRecipient + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    if (portion <= 0) continue;
    await applySavingsMovement(tx, {
      savingsId: r.id,
      accountId: r.accountId,
      familyId: args.familyId,
      amount: portion,
      source: "rounding_auto",
      date: args.date,
      triggeringTransactionId: args.transactionId,
    });
  }
}

/**
 * Remove all rounding_auto savings_transaction rows tied to a parent
 * transaction and roll back the savings balances by their amounts.
 * Used when the parent transaction is updated (re-apply with new state)
 * or deleted (just remove).
 *
 * Note: completedAt / pausedAt are NOT un-set here even if a savings
 * drops back below its target. That's a deliberate edge case — the
 * celebration has already happened from the user's perspective.
 */
async function rollbackRoundingForTransaction(
  tx: DbOrTx,
  transactionId: string,
): Promise<void> {
  const rows = await tx
    .select({
      id: savingsTransaction.id,
      savingsId: savingsTransaction.savingsId,
      amount: savingsTransaction.amount,
    })
    .from(savingsTransaction)
    .where(
      and(
        eq(savingsTransaction.triggeringTransactionId, transactionId),
        eq(savingsTransaction.source, "rounding_auto"),
      ),
    );

  for (const r of rows) {
    await tx
      .update(savings)
      .set({
        balance: sql`${savings.balance} - ${r.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(savings.id, r.savingsId));
  }

  if (rows.length > 0) {
    await tx
      .delete(savingsTransaction)
      .where(
        and(
          eq(savingsTransaction.triggeringTransactionId, transactionId),
          eq(savingsTransaction.source, "rounding_auto"),
        ),
      );
  }
}

async function applyBalanceDelta(
  db: DbOrTx,
  accountId: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return;
  await db
    .update(financialAccount)
    .set({
      balance: sql`${financialAccount.balance} + ${delta}`,
      updatedAt: new Date(),
    })
    .where(eq(financialAccount.id, accountId));
}

/** Return ISO date strings for the current week (Monday–Sunday) in Europe/Copenhagen. */
function currentWeekRange(): { from: string; to: string } {
  const now = new Date();
  // Day of week: 0=Sun..6=Sat; we want Monday-based (0=Mon..6=Sun)
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: toIso(monday), to: toIso(sunday) };
}

export const transactionRouter = createTRPCRouter({
  weeklyExpense: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    const accessibleIds = await getAccessibleAccountIds(
      ctx.db,
      familyId,
      ctx.session.user.id,
    );

    if (accessibleIds.length === 0) return 0;

    const { from, to } = currentWeekRange();

    const [row] = await ctx.db
      .select({
        sum: sql<number>`coalesce(sum(${transaction.amount}), 0)`,
      })
      .from(transaction)
      .where(
        and(
          eq(transaction.familyId, familyId),
          inArray(transaction.accountId, accessibleIds),
          eq(transaction.type, "expense"),
          eq(transaction.excludedFromCalculations, false),
          gte(transaction.date, from),
          lte(transaction.date, to),
        ),
      );

    return Number(row?.sum ?? 0);
  }),

  list: protectedProcedure
    .input(
      z
        .object({
          accountId: z.string().uuid().optional(),
          accountIds: z.array(z.string().uuid()).optional(),
          categoryId: z.string().uuid().nullable().optional(),
          categoryIds: z.array(z.string().uuid()).optional(),
          includeUncategorized: z.boolean().optional(),
          // Filter by project. `null` = transactions with no project assigned.
          // Undefined = no filter applied.
          projectId: z.string().uuid().nullable().optional(),
          type: transactionTypeSchema.optional(),
          search: z.string().optional(),
          from: z.string().optional(), // ISO date YYYY-MM-DD
          to: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(50),
          cursor: z
            .object({
              date: z.string(),
              createdAt: z.string(),
              id: z.string().uuid(),
            })
            .nullish(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const accessibleIds = await getAccessibleAccountIds(
        ctx.db,
        familyId,
        ctx.session.user.id,
      );

      if (accessibleIds.length === 0) {
        return {
          items: [] as (typeof transaction.$inferSelect)[],
          nextCursor: null,
        };
      }

      const conditions = [
        eq(transaction.familyId, familyId),
        inArray(transaction.accountId, accessibleIds),
        // Hide split originals: a row that has child parts is replaced in the
        // list by its parts (which carry the real categories). The parts
        // themselves stay visible. Backed by transaction_split_parent_idx.
        sql`NOT EXISTS (SELECT 1 FROM "transaction" "child" WHERE "child"."split_parent_id" = ${transaction.id})`,
      ];

      if (input?.accountId) {
        conditions.push(eq(transaction.accountId, input.accountId));
      }
      if (input?.accountIds && input.accountIds.length > 0) {
        conditions.push(inArray(transaction.accountId, input.accountIds));
      }
      if (input?.type) {
        conditions.push(eq(transaction.type, input.type));
      }
      if (input?.categoryId !== undefined) {
        if (input.categoryId === null) {
          conditions.push(isNull(transaction.categoryId));
        } else {
          const expanded = await expandCategoryIds(ctx.db, familyId, [
            input.categoryId,
          ]);
          if (expanded.length === 0) {
            return { items: [], nextCursor: null };
          }
          conditions.push(inArray(transaction.categoryId, expanded));
        }
      } else if (
        (input?.categoryIds && input.categoryIds.length > 0) ||
        input?.includeUncategorized
      ) {
        const ids = input?.categoryIds ?? [];
        const expanded =
          ids.length > 0 ? await expandCategoryIds(ctx.db, familyId, ids) : [];
        const branches = [];
        if (expanded.length > 0) {
          branches.push(inArray(transaction.categoryId, expanded));
        }
        if (input?.includeUncategorized) {
          branches.push(isNull(transaction.categoryId));
        }
        if (branches.length === 0) {
          return { items: [], nextCursor: null };
        }
        const combined = branches.length === 1 ? branches[0]! : or(...branches);
        if (combined) conditions.push(combined);
      }
      if (input?.projectId !== undefined) {
        if (input.projectId === null) {
          conditions.push(isNull(transaction.projectId));
        } else {
          conditions.push(eq(transaction.projectId, input.projectId));
        }
      }
      if (input?.search?.trim()) {
        const pattern = `%${input.search.trim()}%`;
        const searchCondition = or(
          ilike(transaction.description, pattern),
          ilike(transaction.note, pattern),
        );
        if (searchCondition) conditions.push(searchCondition);
      }
      if (input?.from) {
        conditions.push(gte(transaction.date, input.from));
      }
      if (input?.to) {
        conditions.push(lte(transaction.date, input.to));
      }
      if (input?.cursor) {
        // Keyset pagination on (date DESC, createdAt DESC, id DESC).
        // Rows "after" the cursor are tuple-less-than in that ordering.
        // Cast the ISO strings so Postgres compares them as the right types
        // — passing a JS Date into a tuple literal crashes postgres-js.
        conditions.push(
          sql`(${transaction.date}, ${transaction.createdAt}, ${transaction.id}) < (${input.cursor.date}::date, ${input.cursor.createdAt}::timestamptz, ${input.cursor.id}::uuid)`,
        );
      }

      const limit = input?.limit ?? 50;
      const rows = await ctx.db
        .select()
        .from(transaction)
        .where(and(...conditions))
        .orderBy(
          desc(transaction.date),
          desc(transaction.createdAt),
          desc(transaction.id),
        )
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const last = items[items.length - 1];
      const nextCursor =
        hasMore && last
          ? {
              date: last.date,
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            }
          : null;

      return { items, nextCursor };
    }),

  create: protectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        type: transactionTypeSchema,
        amount: z.number().int().positive(),
        date: z.string(), // YYYY-MM-DD
        description: z.string().min(1).max(500),
        note: z.string().max(1000).optional(),
        transferGroupId: z.string().uuid().optional(),
        categoryId: z.string().uuid().optional(),
        projectId: z.string().uuid().nullable().optional(),
        excludedFromCalculations: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await assertAccountAccess(ctx.db, familyId, ctx.session.user.id, [
        input.accountId,
      ]);

      if (input.categoryId) {
        await assertCategoryIsLeaf(ctx.db, familyId, input.categoryId);
      }

      const [created] = await ctx.db
        .insert(transaction)
        .values({
          familyId,
          accountId: input.accountId,
          transferGroupId: input.transferGroupId ?? null,
          type: input.type,
          amount: input.amount,
          date: input.date,
          description: input.description,
          note: input.note ?? null,
          categoryId: input.categoryId ?? null,
          projectId: input.projectId ?? null,
          excludedFromCalculations: input.excludedFromCalculations ?? false,
        })
        .returning();

      await applyBalanceDelta(
        ctx.db,
        input.accountId,
        signedDelta(input.type, input.amount),
      );

      if (input.type === "expense" && created) {
        await applyRoundingForExpense(ctx.db, {
          familyId,
          accountId: input.accountId,
          transactionId: created.id,
          amount: input.amount,
          date: input.date,
          transferGroupId: input.transferGroupId,
        });
      }

      await refreshChallengeSnapshotsForFamily(ctx.db, familyId, [input.date]);

      // Learn the merchant→category mapping from this manual entry (skip
      // transfers, which carry no merchant).
      if (input.categoryId && !input.transferGroupId) {
        await learnFromCategorization(ctx.db, {
          familyId,
          description: input.description,
          metadata: null,
          categoryId: input.categoryId,
          source: "user_create",
        });
      }

      return created;
    }),

  bulkImport: protectedProcedure
    .input(
      z.object({
        transactions: z
          .array(
            z.object({
              accountId: z.string().uuid(),
              type: transactionTypeSchema,
              amount: z.number().int().positive(),
              date: z.string(),
              description: z.string().min(1).max(500),
              note: z.string().max(1000).optional(),
              metadata: z.record(z.string(), z.string()).optional(),
              externalId: z.string().min(1),
              transferGroupId: z.string().uuid().optional(),
            }),
          )
          .min(1)
          .max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      const allAccountIds = new Set<string>();
      for (const t of input.transactions) {
        allAccountIds.add(t.accountId);
      }

      await assertAccountAccess(
        ctx.db,
        familyId,
        ctx.session.user.id,
        Array.from(allAccountIds),
      );

      const learnedIndex = indexLearnedRules(
        await loadLearnedRules(ctx.db, familyId),
      );

      const now = new Date();
      const values = input.transactions.map((t) => {
        const rawDescription = stripNullBytes(t.description);
        // Clean the noisy bank text for storage/display. Falls back to the raw
        // text only if cleaning emptied it (it never does for non-empty input).
        const description = sanitizeBankText(rawDescription) || rawDescription;
        const note = t.note ? stripNullBytes(t.note) : null;
        const metadata = sanitizeMetadata(t.metadata);
        // Keep the original bank text for reference/audit. It is NOT matched
        // against — `rawDescription` is not a safelisted metadata key.
        const storedMetadata =
          rawDescription && rawDescription !== description
            ? { ...(metadata ?? {}), rawDescription }
            : metadata;
        // Auto-categorize from learned/seeded merchant rules; null otherwise.
        const categoryId = t.transferGroupId
          ? null
          : ruleCategoryFor(
              learnedIndex,
              deriveMerchantKey(description, storedMetadata),
            );
        return {
          familyId,
          accountId: t.accountId,
          transferGroupId: t.transferGroupId ?? null,
          type: t.type,
          amount: t.amount,
          date: t.date,
          description,
          note,
          metadata: storedMetadata,
          categoryId,
          externalId: stripNullBytes(t.externalId),
          importedAt: now,
        };
      });

      // Insert atomically in chunks so a mid-loop failure can't leave
      // partial data behind.
      const CHUNK = 500;
      let inserted = 0;
      const balanceDeltas = new Map<string, number>();
      type InsertedExpense = {
        id: string;
        accountId: string;
        amount: number;
        date: string;
        transferGroupId: string | null;
      };
      const insertedExpenses: InsertedExpense[] = [];
      try {
        await ctx.db.transaction(async (tx) => {
          for (let i = 0; i < values.length; i += CHUNK) {
            const chunk = values.slice(i, i + CHUNK);
            const result = await tx
              .insert(transaction)
              .values(chunk)
              .onConflictDoNothing({
                target: [transaction.accountId, transaction.externalId],
                where: isNotNull(transaction.externalId),
              })
              .returning({
                id: transaction.id,
                accountId: transaction.accountId,
                type: transaction.type,
                amount: transaction.amount,
                date: transaction.date,
                transferGroupId: transaction.transferGroupId,
              });
            inserted += result.length;
            for (const row of result) {
              const delta = signedDelta(row.type, row.amount);
              balanceDeltas.set(
                row.accountId,
                (balanceDeltas.get(row.accountId) ?? 0) + delta,
              );
              if (row.type === "expense") {
                insertedExpenses.push({
                  id: row.id,
                  accountId: row.accountId,
                  amount: row.amount,
                  date: row.date,
                  transferGroupId: row.transferGroupId,
                });
              }
            }
          }
          for (const [accountId, delta] of balanceDeltas) {
            await applyBalanceDelta(tx, accountId, delta);
          }
          for (const row of insertedExpenses) {
            await applyRoundingForExpense(tx, {
              familyId,
              accountId: row.accountId,
              transactionId: row.id,
              amount: row.amount,
              date: row.date,
              transferGroupId: row.transferGroupId,
            });
          }
        });
      } catch (err) {
        const posthog = getPostHogClient();
        posthog.captureException(
          err instanceof Error ? err : new Error(String(err)),
          ctx.session.user.id,
          {
            procedure: "transaction.bulkImport",
            familyId,
            rowCount: input.transactions.length,
          },
        );
        await posthog.shutdown();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Import failed",
        });
      }

      if (inserted > 0) {
        const dates = Array.from(
          new Set(input.transactions.map((t) => t.date)),
        );
        await refreshChallengeSnapshotsForFamily(ctx.db, familyId, dates);
      }

      return {
        total: input.transactions.length,
        inserted,
        skipped: input.transactions.length - inserted,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        type: transactionTypeSchema.optional(),
        amount: z.number().int().positive().optional(),
        date: z.string().optional(),
        description: z.string().min(1).max(500).optional(),
        note: z.string().max(1000).nullable().optional(),
        transferGroupId: z.string().uuid().nullable().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        projectId: z.string().uuid().nullable().optional(),
        excludedFromCalculations: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const { id, ...data } = input;

      const [existing] = await ctx.db
        .select({
          accountId: transaction.accountId,
          date: transaction.date,
          type: transaction.type,
          amount: transaction.amount,
          categoryId: transaction.categoryId,
          description: transaction.description,
          metadata: transaction.metadata,
          transferGroupId: transaction.transferGroupId,
          splitParentId: transaction.splitParentId,
        })
        .from(transaction)
        .where(and(eq(transaction.id, id), eq(transaction.familyId, familyId)));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await assertAccountAccess(ctx.db, familyId, ctx.session.user.id, [
        existing.accountId,
      ]);

      // A split part's amount/type is owned by the split (it must keep summing
      // to the bank original). Editing it here would desync the parts from the
      // original and corrupt the balance — parts never moved balance, so the
      // delta below would be wrong. Change parts via updateSplit instead.
      const isPart = existing.splitParentId !== null;
      if (
        isPart &&
        ((data.amount !== undefined && data.amount !== existing.amount) ||
          (data.type !== undefined && data.type !== existing.type))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Edit a split part's amount via Edit split",
        });
      }

      if (data.categoryId) {
        await assertCategoryIsLeaf(ctx.db, familyId, data.categoryId);
      }

      await ctx.db
        .update(transaction)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(transaction.id, id), eq(transaction.familyId, familyId)));

      const oldDelta = signedDelta(existing.type, existing.amount);
      const newType = data.type ?? existing.type;
      const newAmount = data.amount ?? existing.amount;
      const newDelta = signedDelta(newType, newAmount);
      await applyBalanceDelta(ctx.db, existing.accountId, newDelta - oldDelta);

      // Rounding tied to the prior state must be discarded before
      // re-applying for the new state — otherwise a type or amount
      // change leaves stale savings_transaction rows behind.
      const oldWasExpense = existing.type === "expense";
      const newIsExpense = newType === "expense";
      const amountChanged = newAmount !== existing.amount;
      if (oldWasExpense && (amountChanged || !newIsExpense)) {
        await rollbackRoundingForTransaction(ctx.db, id);
      }
      if (newIsExpense && (amountChanged || !oldWasExpense)) {
        await applyRoundingForExpense(ctx.db, {
          familyId,
          accountId: existing.accountId,
          transactionId: id,
          amount: newAmount,
          date: data.date ?? existing.date,
          transferGroupId: data.transferGroupId,
        });
      }

      const affectedDates = [existing.date];
      if (data.date && data.date !== existing.date) {
        affectedDates.push(data.date);
      }
      await refreshChallengeSnapshotsForFamily(ctx.db, familyId, affectedDates);

      // Learn from a user categorization/correction: only when a (non-null)
      // category was set that differs from the previous one, and the row isn't
      // a transfer. Correcting away from a wrong auto-assignment is the
      // strongest signal — the same upsert also bumps the wrong rule's
      // conflictCount.
      if (
        data.categoryId !== undefined &&
        data.categoryId !== null &&
        data.categoryId !== existing.categoryId &&
        !existing.transferGroupId
      ) {
        await learnFromCategorization(ctx.db, {
          familyId,
          description: data.description ?? existing.description,
          metadata: existing.metadata,
          categoryId: data.categoryId,
          source: "user_correction",
        });
      }
    }),

  /**
   * After a user categorizes one transaction, offer to apply the same category
   * to other UNCATEGORIZED transactions from the same merchant. `dryRun` returns
   * just the count (to power the prompt); a real run also learns the rule once.
   */
  applyToSimilar: protectedProcedure
    .input(
      z.object({
        sourceTransactionId: z.string().uuid(),
        categoryId: z.string().uuid(),
        dryRun: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const accessibleIds = await getAccessibleAccountIds(
        ctx.db,
        familyId,
        ctx.session.user.id,
      );
      if (accessibleIds.length === 0) return { matched: 0, updated: 0 };

      await assertCategoryIsLeaf(ctx.db, familyId, input.categoryId);

      const [source] = await ctx.db
        .select({
          description: transaction.description,
          metadata: transaction.metadata,
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.id, input.sourceTransactionId),
            eq(transaction.familyId, familyId),
          ),
        );
      if (!source) return { matched: 0, updated: 0 };

      const merchantKey = deriveMerchantKey(
        source.description,
        source.metadata,
      );
      if (!merchantKey) return { matched: 0, updated: 0 };

      // Candidate set: uncategorized rows in accessible accounts. The merchant
      // key is derived in JS, so it can't be a SQL filter — fine at current
      // volume. (A denormalized transaction.merchant_key column is the
      // scaling follow-up once bank streaming raises volume.)
      const candidates = await ctx.db
        .select({
          id: transaction.id,
          date: transaction.date,
          description: transaction.description,
          metadata: transaction.metadata,
          transferGroupId: transaction.transferGroupId,
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.familyId, familyId),
            inArray(transaction.accountId, accessibleIds),
            isNull(transaction.categoryId),
            // Exclude the source row itself (it's being categorized via the
            // separate update; this avoids a race counting it as "similar").
            ne(transaction.id, input.sourceTransactionId),
          ),
        );

      const matches = candidates.filter(
        (tx) =>
          !tx.transferGroupId &&
          deriveMerchantKey(tx.description, tx.metadata) === merchantKey,
      );

      if (input.dryRun) return { matched: matches.length, updated: 0 };
      if (matches.length === 0) return { matched: 0, updated: 0 };

      await ctx.db
        .update(transaction)
        .set({ categoryId: input.categoryId, updatedAt: new Date() })
        .where(
          and(
            inArray(
              transaction.id,
              matches.map((m) => m.id),
            ),
            eq(transaction.familyId, familyId),
          ),
        );

      // One user decision → one learning hit (not one per row).
      await learnFromCategorization(ctx.db, {
        familyId,
        description: source.description,
        metadata: source.metadata,
        categoryId: input.categoryId,
        source: "apply_to_similar",
      });

      await refreshChallengeSnapshotsForFamily(
        ctx.db,
        familyId,
        matches.map((m) => m.date),
      );

      return { matched: matches.length, updated: matches.length };
    }),

  bulkUpdate: protectedProcedure
    .input(
      z
        .object({
          ids: z.array(z.string().uuid()).min(1).max(500),
          categoryId: z.string().uuid().nullable().optional(),
          projectId: z.string().uuid().nullable().optional(),
          excludedFromCalculations: z.boolean().optional(),
        })
        .refine(
          (v) =>
            v.categoryId !== undefined ||
            v.projectId !== undefined ||
            v.excludedFromCalculations !== undefined,
          { message: "At least one field must be provided" },
        ),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const accessibleIds = await getAccessibleAccountIds(
        ctx.db,
        familyId,
        ctx.session.user.id,
      );

      if (accessibleIds.length === 0) return { updated: 0 };

      if (input.categoryId) {
        await assertCategoryIsLeaf(ctx.db, familyId, input.categoryId);
      }

      const result = await ctx.db
        .update(transaction)
        .set({
          updatedAt: new Date(),
          ...(input.categoryId !== undefined
            ? { categoryId: input.categoryId }
            : {}),
          ...(input.projectId !== undefined
            ? { projectId: input.projectId }
            : {}),
          ...(input.excludedFromCalculations !== undefined
            ? { excludedFromCalculations: input.excludedFromCalculations }
            : {}),
        })
        .where(
          and(
            inArray(transaction.id, input.ids),
            eq(transaction.familyId, familyId),
            inArray(transaction.accountId, accessibleIds),
          ),
        )
        .returning({ id: transaction.id, date: transaction.date });

      if (result.length > 0) {
        await refreshChallengeSnapshotsForFamily(
          ctx.db,
          familyId,
          result.map((r) => r.date),
        );
      }

      return { updated: result.length };
    }),

  /**
   * Split one transaction into ≥2 parts, each with its own category. The
   * original stays the bank source of truth (keeps externalId, amount, and
   * account-balance contribution) but is flipped to
   * excludedFromCalculations=true; the parts carry the real categories, are
   * counted in calcs, have externalId=NULL, and never touch the account
   * balance. Net effect on balance / net worth: zero.
   */
  split: protectedProcedure
    .input(
      z.object({
        transactionId: z.string().uuid(),
        parts: z
          .array(
            z.object({
              amount: z.number().int().positive(),
              categoryId: z.string().uuid().optional(),
              projectId: z.string().uuid().nullable().optional(),
              note: z.string().max(1000).optional(),
            }),
          )
          .min(2),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const original = await loadSplitOriginal(
        ctx.db,
        familyId,
        ctx.session.user.id,
        input.transactionId,
      );

      const guard = checkSplittableOriginal(original);
      if (!guard.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            guard.reason === "is_transfer"
              ? "Cannot split a transfer"
              : "Cannot split a part",
        });
      }

      const alreadySplit = await hasSplitParts(ctx.db, original.id);
      if (alreadySplit) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Transaction is already split",
        });
      }

      assertSplitSum(original.amount, input.parts);
      await assertPartCategoriesLeaf(ctx.db, familyId, input.parts);

      await ctx.db.transaction(async (tx) => {
        await tx.insert(transaction).values(
          input.parts.map((p) => ({
            familyId,
            accountId: original.accountId,
            splitParentId: original.id,
            type: original.type,
            amount: p.amount,
            date: original.date,
            description: original.description,
            note: p.note ?? null,
            categoryId: p.categoryId ?? null,
            projectId: p.projectId ?? null,
            excludedFromCalculations: false,
          })),
        );
        await tx
          .update(transaction)
          .set({ excludedFromCalculations: true, updatedAt: new Date() })
          .where(eq(transaction.id, original.id));
      });

      await refreshChallengeSnapshotsForFamily(ctx.db, familyId, [
        original.date,
      ]);
    }),

  /** Re-validate the sum and replace all parts of an existing split. */
  updateSplit: protectedProcedure
    .input(
      z.object({
        transactionId: z.string().uuid(),
        parts: z
          .array(
            z.object({
              amount: z.number().int().positive(),
              categoryId: z.string().uuid().optional(),
              projectId: z.string().uuid().nullable().optional(),
              note: z.string().max(1000).optional(),
            }),
          )
          .min(2),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const original = await loadSplitOriginal(
        ctx.db,
        familyId,
        ctx.session.user.id,
        input.transactionId,
      );

      if (!(await hasSplitParts(ctx.db, original.id))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Transaction is not split",
        });
      }

      assertSplitSum(original.amount, input.parts);
      await assertPartCategoriesLeaf(ctx.db, familyId, input.parts);

      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(transaction)
          .where(eq(transaction.splitParentId, original.id));
        await tx.insert(transaction).values(
          input.parts.map((p) => ({
            familyId,
            accountId: original.accountId,
            splitParentId: original.id,
            type: original.type,
            amount: p.amount,
            date: original.date,
            description: original.description,
            note: p.note ?? null,
            categoryId: p.categoryId ?? null,
            projectId: p.projectId ?? null,
            excludedFromCalculations: false,
          })),
        );
      });

      await refreshChallengeSnapshotsForFamily(ctx.db, familyId, [
        original.date,
      ]);
    }),

  /** Remove all parts and restore the original to calculations and the list. */
  unsplit: protectedProcedure
    .input(z.object({ transactionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const original = await loadSplitOriginal(
        ctx.db,
        familyId,
        ctx.session.user.id,
        input.transactionId,
      );

      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(transaction)
          .where(eq(transaction.splitParentId, original.id));
        await tx
          .update(transaction)
          .set({ excludedFromCalculations: false, updatedAt: new Date() })
          .where(eq(transaction.id, original.id));
      });

      await refreshChallengeSnapshotsForFamily(ctx.db, familyId, [
        original.date,
      ]);
    }),

  /**
   * Inspect view: returns the bank-source original (date, description, full
   * amount, account, externalId bank reference) plus its sibling parts.
   * Accepts either the original's id or any part's id.
   */
  getSplit: protectedProcedure
    .input(z.object({ transactionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      const [row] = await ctx.db
        .select({
          id: transaction.id,
          splitParentId: transaction.splitParentId,
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.id, input.transactionId),
            eq(transaction.familyId, familyId),
          ),
        );
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const originalId = row.splitParentId ?? row.id;

      const [original] = await ctx.db
        .select({
          id: transaction.id,
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          type: transaction.type,
          accountId: transaction.accountId,
          accountName: financialAccount.name,
          externalId: transaction.externalId,
        })
        .from(transaction)
        .innerJoin(
          financialAccount,
          eq(financialAccount.id, transaction.accountId),
        )
        .where(
          and(
            eq(transaction.id, originalId),
            eq(transaction.familyId, familyId),
          ),
        );
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });

      await assertAccountAccess(ctx.db, familyId, ctx.session.user.id, [
        original.accountId,
      ]);

      const parts = await ctx.db
        .select({
          id: transaction.id,
          amount: transaction.amount,
          categoryId: transaction.categoryId,
          projectId: transaction.projectId,
          note: transaction.note,
        })
        .from(transaction)
        .where(eq(transaction.splitParentId, originalId))
        .orderBy(transaction.createdAt, transaction.id);

      return { original, parts };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      const [existing] = await ctx.db
        .select({
          accountId: transaction.accountId,
          date: transaction.date,
          type: transaction.type,
          amount: transaction.amount,
          splitParentId: transaction.splitParentId,
        })
        .from(transaction)
        .where(
          and(eq(transaction.id, input.id), eq(transaction.familyId, familyId)),
        );

      if (!existing) return;
      await assertAccountAccess(ctx.db, familyId, ctx.session.user.id, [
        existing.accountId,
      ]);

      // A part never moved the account balance (the original owns it) and
      // never triggered rounding, so deleting one must NOT roll back balance.
      const isPart = existing.splitParentId !== null;

      if (existing.type === "expense" && !isPart) {
        await rollbackRoundingForTransaction(ctx.db, input.id);
      }

      // Deleting an original with parts cascades the parts away (FK). Those
      // parts were counted in calcs, so the snapshot refresh below (on the
      // shared date) drops their contribution.
      await ctx.db
        .delete(transaction)
        .where(
          and(eq(transaction.id, input.id), eq(transaction.familyId, familyId)),
        );

      if (!isPart) {
        await applyBalanceDelta(
          ctx.db,
          existing.accountId,
          -signedDelta(existing.type, existing.amount),
        );
      }
      await refreshChallengeSnapshotsForFamily(ctx.db, familyId, [
        existing.date,
      ]);
    }),
});
