import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { db as dbInstance } from "~/server/db";
import {
  budget,
  budgetAccount,
  budgetLine,
  category,
  financialAccount,
  transaction,
  user,
} from "~/server/db/schema";
import {
  defaultStartMonth,
  distributeByPeriod,
} from "~/server/lib/budget-distribute";

// ── Validation ──────────────────────────────────────────────────────────────

const recurrenceSchema = z.enum([
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "custom",
]);

const yearSchema = z.number().int().min(1900).max(3000);
const startMonthSchema = z.number().int().min(0).max(11);

type DbOrTx =
  | Parameters<Parameters<typeof dbInstance.transaction>[0]>[0]
  | typeof dbInstance;

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

async function loadBudgetInFamily(
  db: DbOrTx,
  budgetId: string,
  familyId: string,
) {
  const [row] = await db
    .select()
    .from(budget)
    .where(and(eq(budget.id, budgetId), eq(budget.familyId, familyId)));
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Budget not found" });
  }
  return row;
}

async function loadLineInFamily(
  db: DbOrTx,
  lineId: string,
  familyId: string,
) {
  const [row] = await db
    .select({
      id: budgetLine.id,
      budgetId: budgetLine.budgetId,
      categoryId: budgetLine.categoryId,
      name: budgetLine.name,
      recurrence: budgetLine.recurrence,
      startMonth: budgetLine.startMonth,
      amounts: budgetLine.amounts,
      sortOrder: budgetLine.sortOrder,
    })
    .from(budgetLine)
    .innerJoin(budget, eq(budget.id, budgetLine.budgetId))
    .where(and(eq(budgetLine.id, lineId), eq(budget.familyId, familyId)));
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Budget line not found" });
  }
  return row;
}

async function assertCategoryBelongsToFamily(
  db: DbOrTx,
  categoryId: string,
  familyId: string,
) {
  const [row] = await db
    .select({ id: category.id, kind: category.kind })
    .from(category)
    .where(and(eq(category.id, categoryId), eq(category.familyId, familyId)));
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
  }
  if (row.kind !== "expense") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Budget lines must use expense categories",
    });
  }
}

const EMPTY_AMOUNTS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function normaliseAmounts(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...EMPTY_AMOUNTS];
  const source = raw as unknown[];
  const normalised = [...EMPTY_AMOUNTS];
  for (let i = 0; i < 12; i++) {
    const v = source[i];
    normalised[i] = typeof v === "number" && Number.isFinite(v) ? v : 0;
  }
  return normalised;
}

function sumAmounts(amounts: number[]): number {
  return amounts.reduce((acc, v) => acc + v, 0);
}

async function fetchActualsByCategory(
  db: DbOrTx,
  familyId: string,
  year: number,
  categoryIds: string[],
  accountIds: string[] | null,
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  if (categoryIds.length === 0) return result;
  // accountIds === null → no filter (all family accounts). An empty array
  // would mean "no accounts" (nothing to count) — return empty.
  if (accountIds?.length === 0) return result;

  const filters = [
    eq(transaction.familyId, familyId),
    eq(transaction.type, "expense"),
    inArray(transaction.categoryId, categoryIds),
    gte(transaction.date, `${year}-01-01`),
    lt(transaction.date, `${year + 1}-01-01`),
  ];
  if (accountIds) {
    filters.push(inArray(transaction.accountId, accountIds));
  }

  const rows = await db
    .select({
      categoryId: transaction.categoryId,
      month: sql<number>`extract(month from ${transaction.date})::int`,
      total: sql<number>`coalesce(sum(${transaction.amount}), 0)::int`,
    })
    .from(transaction)
    .where(and(...filters))
    .groupBy(
      transaction.categoryId,
      sql`extract(month from ${transaction.date})`,
    );

  for (const row of rows) {
    if (!row.categoryId) continue;
    const arr = result.get(row.categoryId) ?? [...EMPTY_AMOUNTS];
    const slot = Number(row.month) - 1;
    if (slot >= 0 && slot < 12) {
      arr[slot] = Number(row.total);
    }
    result.set(row.categoryId, arr);
  }
  return result;
}

// Load all accountIds currently attached to each budget in the given set.
async function loadAccountIdsByBudget(
  db: DbOrTx,
  budgetIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (budgetIds.length === 0) return map;
  const rows = await db
    .select({
      budgetId: budgetAccount.budgetId,
      accountId: budgetAccount.accountId,
    })
    .from(budgetAccount)
    .where(inArray(budgetAccount.budgetId, budgetIds));
  for (const row of rows) {
    const list = map.get(row.budgetId) ?? [];
    list.push(row.accountId);
    map.set(row.budgetId, list);
  }
  return map;
}

async function assertAccountsBelongToFamily(
  db: DbOrTx,
  accountIds: string[],
  familyId: string,
) {
  if (accountIds.length === 0) return;
  const rows = await db
    .select({ id: financialAccount.id })
    .from(financialAccount)
    .where(
      and(
        inArray(financialAccount.id, accountIds),
        eq(financialAccount.familyId, familyId),
      ),
    );
  if (rows.length !== accountIds.length) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Account not found in family",
    });
  }
}

async function replaceBudgetAccounts(
  db: DbOrTx,
  budgetId: string,
  accountIds: string[],
) {
  await db.delete(budgetAccount).where(eq(budgetAccount.budgetId, budgetId));
  if (accountIds.length === 0) return;
  await db.insert(budgetAccount).values(
    accountIds.map((accountId) => ({
      budgetId,
      accountId,
    })),
  );
}

// NOTE: When budget actuals count expense transactions by category, multiple
// lines sharing the same category BOTH see the same actuals total (we don't
// split by line — there's no per-line filter on transactions). Accepted MVP
// behaviour: the user sees the same spend reflected against each line, which
// is what you want when "Weekly shop" and "Pantry stock" are two planning
// buckets for the same real-world category.

// ── Router ──────────────────────────────────────────────────────────────────

export const budgetRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ year: yearSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      const whereClause = input?.year
        ? and(eq(budget.familyId, familyId), eq(budget.year, input.year))
        : eq(budget.familyId, familyId);

      const budgets = await ctx.db
        .select()
        .from(budget)
        .where(whereClause)
        .orderBy(desc(budget.year), asc(budget.name));

      if (budgets.length === 0) return [];

      const budgetIds = budgets.map((b) => b.id);

      const lines = await ctx.db
        .select({
          id: budgetLine.id,
          budgetId: budgetLine.budgetId,
          categoryId: budgetLine.categoryId,
          amounts: budgetLine.amounts,
        })
        .from(budgetLine)
        .where(inArray(budgetLine.budgetId, budgetIds));

      const linesByBudget = new Map<
        string,
        { categoryIds: Set<string>; planned: number; count: number }
      >();
      for (const l of lines) {
        const entry = linesByBudget.get(l.budgetId) ?? {
          categoryIds: new Set<string>(),
          planned: 0,
          count: 0,
        };
        entry.planned += sumAmounts(normaliseAmounts(l.amounts));
        entry.count += 1;
        if (l.categoryId) entry.categoryIds.add(l.categoryId);
        linesByBudget.set(l.budgetId, entry);
      }

      const accountIdsByBudget = await loadAccountIdsByBudget(
        ctx.db,
        budgetIds,
      );

      // Actuals must be scoped per-budget because each budget can limit to a
      // different set of accounts. Run the query per budget (they're small and
      // narrow; per-budget scoping keeps the logic simple).
      const actualsByBudget = await Promise.all(
        budgets.map(async (b) => {
          const entry = linesByBudget.get(b.id);
          if (!entry) return { budgetId: b.id, map: new Map<string, number[]>() };
          const accountIds = accountIdsByBudget.get(b.id) ?? [];
          const map = await fetchActualsByCategory(
            ctx.db,
            familyId,
            b.year,
            Array.from(entry.categoryIds),
            accountIds.length > 0 ? accountIds : null,
          );
          return { budgetId: b.id, map };
        }),
      );
      const actualsByBudgetMap = new Map(
        actualsByBudget.map((x) => [x.budgetId, x.map]),
      );

      return budgets.map((b) => {
        const entry = linesByBudget.get(b.id);
        const actuals = actualsByBudgetMap.get(b.id);
        let totalActual = 0;
        if (entry && actuals) {
          for (const cid of entry.categoryIds) {
            const arr = actuals.get(cid);
            if (arr) totalActual += sumAmounts(arr);
          }
        }
        return {
          ...b,
          lineCount: entry?.count ?? 0,
          totalPlanned: entry?.planned ?? 0,
          totalActual,
          accountIds: accountIdsByBudget.get(b.id) ?? [],
        };
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const b = await loadBudgetInFamily(ctx.db, input.id, familyId);

      const lines = await ctx.db
        .select({
          id: budgetLine.id,
          budgetId: budgetLine.budgetId,
          categoryId: budgetLine.categoryId,
          name: budgetLine.name,
          recurrence: budgetLine.recurrence,
          startMonth: budgetLine.startMonth,
          amounts: budgetLine.amounts,
          sortOrder: budgetLine.sortOrder,
          createdAt: budgetLine.createdAt,
          updatedAt: budgetLine.updatedAt,
          categoryName: category.name,
          categoryIcon: category.icon,
          categoryArchived: category.archived,
        })
        .from(budgetLine)
        .leftJoin(category, eq(category.id, budgetLine.categoryId))
        .where(eq(budgetLine.budgetId, b.id))
        .orderBy(asc(budgetLine.sortOrder), asc(budgetLine.createdAt));

      const categoryIds = lines
        .map((l) => l.categoryId)
        .filter((c): c is string => !!c);
      const accountIds = (await loadAccountIdsByBudget(ctx.db, [b.id])).get(
        b.id,
      ) ?? [];
      const actuals = await fetchActualsByCategory(
        ctx.db,
        familyId,
        b.year,
        categoryIds,
        accountIds.length > 0 ? accountIds : null,
      );

      // Per-category actuals. Lines no longer carry actuals — the grid shows
      // actuals only on category roll-up rows, so exposing a single map keyed
      // by categoryId prevents double-counting when two lines share a
      // category.
      const categoryActuals: Record<string, number[]> = {};
      for (const [cid, arr] of actuals) categoryActuals[cid] = arr;

      return {
        ...b,
        accountIds,
        lines: lines.map((l) => ({
          id: l.id,
          budgetId: l.budgetId,
          categoryId: l.categoryId,
          name: l.name,
          recurrence: l.recurrence,
          startMonth: l.startMonth,
          amounts: normaliseAmounts(l.amounts),
          sortOrder: l.sortOrder,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
          categoryName: l.categoryName,
          categoryIcon: l.categoryIcon,
          categoryArchived: l.categoryArchived,
        })),
        categoryActuals,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        year: yearSchema,
        name: z.string().min(1).max(100),
        description: z.string().max(1000).optional(),
        accountIds: z.array(z.string().uuid()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      return await ctx.db.transaction(async (tx) => {
        if (input.accountIds && input.accountIds.length > 0) {
          await assertAccountsBelongToFamily(tx, input.accountIds, familyId);
        }

        const [created] = await tx
          .insert(budget)
          .values({
            familyId,
            year: input.year,
            name: input.name,
            description: input.description ?? null,
          })
          .returning();
        if (!created) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        if (input.accountIds && input.accountIds.length > 0) {
          await replaceBudgetAccounts(tx, created.id, input.accountIds);
        }
        return created;
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        year: yearSchema.optional(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(1000).nullable().optional(),
        accountIds: z.array(z.string().uuid()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const { id, accountIds, ...data } = input;

      await ctx.db.transaction(async (tx) => {
        await loadBudgetInFamily(tx, id, familyId);

        if (accountIds !== undefined) {
          await assertAccountsBelongToFamily(tx, accountIds, familyId);
        }

        if (Object.keys(data).length > 0) {
          await tx
            .update(budget)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(budget.id, id));
        }

        if (accountIds !== undefined) {
          await replaceBudgetAccounts(tx, id, accountIds);
        }
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await ctx.db
        .delete(budget)
        .where(and(eq(budget.id, input.id), eq(budget.familyId, familyId)));
    }),

  createLine: protectedProcedure
    .input(
      z.object({
        budgetId: z.string().uuid(),
        categoryId: z.string().uuid(),
        name: z.string().trim().min(1).max(100),
        recurrence: recurrenceSchema,
        startMonth: startMonthSchema.nullable().optional(),
        periodAmount: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await loadBudgetInFamily(ctx.db, input.budgetId, familyId);
      await assertCategoryBelongsToFamily(ctx.db, input.categoryId, familyId);

      const [orderRow] = await ctx.db
        .select({
          maxOrder: sql<number>`coalesce(max(${budgetLine.sortOrder}), -1)`,
        })
        .from(budgetLine)
        .where(eq(budgetLine.budgetId, input.budgetId));

      const effectiveStart =
        input.startMonth ?? defaultStartMonth(input.recurrence);
      const amounts = distributeByPeriod(
        input.periodAmount,
        input.recurrence,
        effectiveStart,
      );

      const [created] = await ctx.db
        .insert(budgetLine)
        .values({
          budgetId: input.budgetId,
          categoryId: input.categoryId,
          name: input.name,
          recurrence: input.recurrence,
          startMonth:
            input.recurrence === "monthly" || input.recurrence === "custom"
              ? null
              : effectiveStart,
          amounts,
          sortOrder: Number(orderRow?.maxOrder ?? -1) + 1,
        })
        .returning();
      return created;
    }),

  updateLine: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        categoryId: z.string().uuid().nullable().optional(),
        name: z.string().trim().min(1).max(100).optional(),
        recurrence: recurrenceSchema.optional(),
        startMonth: startMonthSchema.nullable().optional(),
        periodAmount: z.number().int().min(0).optional(),
        redistribute: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const existing = await loadLineInFamily(ctx.db, input.id, familyId);

      if (input.categoryId) {
        await assertCategoryBelongsToFamily(ctx.db, input.categoryId, familyId);
      }

      const nextRecurrence = input.recurrence ?? existing.recurrence;
      const nextStartMonth =
        input.startMonth !== undefined
          ? input.startMonth
          : existing.startMonth ?? defaultStartMonth(nextRecurrence);

      const patch: Partial<typeof budgetLine.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.categoryId !== undefined) {
        patch.categoryId = input.categoryId;
      }
      if (input.name !== undefined) {
        patch.name = input.name;
      }
      if (input.recurrence !== undefined) {
        patch.recurrence = input.recurrence;
      }
      if (input.startMonth !== undefined || input.recurrence !== undefined) {
        patch.startMonth =
          nextRecurrence === "monthly" || nextRecurrence === "custom"
            ? null
            : nextStartMonth;
      }

      if (input.redistribute) {
        const periodAmount =
          input.periodAmount ??
          firstNonZeroSlot(normaliseAmounts(existing.amounts));
        patch.amounts = distributeByPeriod(
          periodAmount,
          nextRecurrence,
          nextStartMonth,
        );
      }

      await ctx.db.update(budgetLine).set(patch).where(eq(budgetLine.id, input.id));
    }),

  updateCell: protectedProcedure
    .input(
      z.object({
        lineId: z.string().uuid(),
        monthIndex: z.number().int().min(0).max(11),
        amount: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const existing = await loadLineInFamily(ctx.db, input.lineId, familyId);

      const amounts = normaliseAmounts(existing.amounts);
      amounts[input.monthIndex] = input.amount;

      await ctx.db
        .update(budgetLine)
        .set({ amounts, updatedAt: new Date() })
        .where(eq(budgetLine.id, input.lineId));

      return { amounts };
    }),

  deleteLine: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await loadLineInFamily(ctx.db, input.id, familyId);
      await ctx.db.delete(budgetLine).where(eq(budgetLine.id, input.id));
    }),

  reorderLines: protectedProcedure
    .input(
      z.object({
        budgetId: z.string().uuid(),
        lineIds: z.array(z.string().uuid()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await loadBudgetInFamily(ctx.db, input.budgetId, familyId);

      await ctx.db.transaction(async (tx) => {
        for (let i = 0; i < input.lineIds.length; i++) {
          await tx
            .update(budgetLine)
            .set({ sortOrder: i, updatedAt: new Date() })
            .where(
              and(
                eq(budgetLine.id, input.lineIds[i]!),
                eq(budgetLine.budgetId, input.budgetId),
              ),
            );
        }
      });
    }),
});

function firstNonZeroSlot(amounts: number[]): number {
  for (const v of amounts) if (v > 0) return v;
  return 0;
}
