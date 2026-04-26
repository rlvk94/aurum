import { z } from "zod";
import { and, asc, eq, gte, lte, or, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { requireWithinLimit } from "~/server/billing/entitlements";
import { db as dbInstance } from "~/server/db";
import {
  category,
  financialAccount,
  financialAccountAccess,
  transaction,
  user,
  usersToFamilies,
} from "~/server/db/schema";

async function getActiveFamilyId(
  db: typeof dbInstance,
  userId: string,
) {
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

async function getAccessibleAccountFilter(
  db: typeof dbInstance,
  familyId: string,
  userId: string,
) {
  const accessRows = await db
    .select({ accountId: financialAccountAccess.accountId })
    .from(financialAccountAccess)
    .where(eq(financialAccountAccess.userId, userId));

  const accessibleIds = accessRows.map((r) => r.accountId);

  return and(
    eq(financialAccount.familyId, familyId),
    or(
      eq(financialAccount.visibility, "shared"),
      accessibleIds.length > 0
        ? inArray(financialAccount.id, accessibleIds)
        : undefined,
    ),
  );
}

async function assertUsersInFamily(
  db: typeof dbInstance,
  familyId: string,
  userIds: string[],
) {
  if (userIds.length === 0) return;
  const rows = await db
    .select({ userId: usersToFamilies.userId })
    .from(usersToFamilies)
    .where(
      and(
        eq(usersToFamilies.familyId, familyId),
        inArray(usersToFamilies.userId, userIds),
      ),
    );
  if (rows.length !== new Set(userIds).size) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "One or more users are not members of this family",
    });
  }
}

async function assertUserCanEditAccount(
  db: typeof dbInstance,
  familyId: string,
  userId: string,
  accountId: string,
) {
  const [existing] = await db
    .select({
      id: financialAccount.id,
      visibility: financialAccount.visibility,
    })
    .from(financialAccount)
    .where(
      and(
        eq(financialAccount.id, accountId),
        eq(financialAccount.familyId, familyId),
      ),
    );
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  if (existing.visibility === "private") {
    const [has] = await db
      .select({ userId: financialAccountAccess.userId })
      .from(financialAccountAccess)
      .where(
        and(
          eq(financialAccountAccess.accountId, accountId),
          eq(financialAccountAccess.userId, userId),
        ),
      );
    if (!has) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No access to this account",
      });
    }
  }
  return existing;
}

async function replaceAccessList(
  db: typeof dbInstance,
  accountId: string,
  userIds: string[],
) {
  const targetSet = new Set(userIds);
  const existingRows = await db
    .select({ userId: financialAccountAccess.userId })
    .from(financialAccountAccess)
    .where(eq(financialAccountAccess.accountId, accountId));
  const existingSet = new Set(existingRows.map((r) => r.userId));

  const toDelete = [...existingSet].filter((u) => !targetSet.has(u));
  const toAdd = [...targetSet].filter((u) => !existingSet.has(u));

  if (toDelete.length > 0) {
    await db
      .delete(financialAccountAccess)
      .where(
        and(
          eq(financialAccountAccess.accountId, accountId),
          inArray(financialAccountAccess.userId, toDelete),
        ),
      );
  }
  if (toAdd.length > 0) {
    await db.insert(financialAccountAccess).values(
      toAdd.map((userId) => ({ accountId, userId })),
    );
  }
}

export const financialAccountRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    const filter = await getAccessibleAccountFilter(
      ctx.db,
      familyId,
      ctx.session.user.id,
    );

    return ctx.db
      .select()
      .from(financialAccount)
      .where(filter)
      .orderBy(asc(sql`lower(${financialAccount.name})`));
  }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    const filter = await getAccessibleAccountFilter(
      ctx.db,
      familyId,
      ctx.session.user.id,
    );

    const [result] = await ctx.db
      .select({
        totalBalance: sql<number>`coalesce(sum(${financialAccount.balance}), 0)`,
        netWorthBalance: sql<number>`coalesce(sum(case when ${financialAccount.includeInNetWorth} then ${financialAccount.balance} else 0 end), 0)`,
      })
      .from(financialAccount)
      .where(and(filter, eq(financialAccount.archived, false)));

    return {
      totalBalance: Number(result?.totalBalance ?? 0),
      netWorthBalance: Number(result?.netWorthBalance ?? 0),
    };
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const filter = await getAccessibleAccountFilter(
        ctx.db,
        familyId,
        ctx.session.user.id,
      );

      const [account] = await ctx.db
        .select()
        .from(financialAccount)
        .where(and(filter, eq(financialAccount.id, input.id)));

      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return account;
    }),

  stats: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        months: z.number().int().min(1).max(36).default(12),
      }),
    )
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const filter = await getAccessibleAccountFilter(
        ctx.db,
        familyId,
        ctx.session.user.id,
      );

      const [account] = await ctx.db
        .select({ id: financialAccount.id })
        .from(financialAccount)
        .where(and(filter, eq(financialAccount.id, input.id)));

      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Build the month window: first day of (now - (months-1)) through now.
      const now = new Date();
      const startDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (input.months - 1), 1),
      );
      const endDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
      );
      const toIso = (d: Date) => d.toISOString().slice(0, 10);
      const fromStr = toIso(startDate);
      const toStr = toIso(endDate);

      const monthKeys: string[] = [];
      for (let i = 0; i < input.months; i++) {
        const d = new Date(
          Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + i, 1),
        );
        monthKeys.push(
          `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
        );
      }

      const monthlyRows = await ctx.db
        .select({
          month: sql<string>`to_char(${transaction.date}, 'YYYY-MM')`,
          type: transaction.type,
          total: sql<number>`coalesce(sum(${transaction.amount}), 0)`,
        })
        .from(transaction)
        .where(
          and(
            eq(transaction.familyId, familyId),
            eq(transaction.accountId, input.id),
            inArray(transaction.type, ["expense", "income"]),
            eq(transaction.excludedFromCalculations, false),
            gte(transaction.date, fromStr),
            lte(transaction.date, toStr),
          ),
        )
        .groupBy(sql`to_char(${transaction.date}, 'YYYY-MM')`, transaction.type);

      const monthMap = new Map<
        string,
        { incomeCents: number; expenseCents: number }
      >();
      for (const key of monthKeys) {
        monthMap.set(key, { incomeCents: 0, expenseCents: 0 });
      }
      for (const row of monthlyRows) {
        const bucket = monthMap.get(row.month);
        if (!bucket) continue;
        const total = Number(row.total);
        if (row.type === "income") bucket.incomeCents = total;
        else if (row.type === "expense") bucket.expenseCents = total;
      }

      const monthly = monthKeys.map((month) => ({
        month,
        incomeCents: monthMap.get(month)?.incomeCents ?? 0,
        expenseCents: monthMap.get(month)?.expenseCents ?? 0,
      }));

      // Category split: expenses only, grouped by category (null = uncategorized).
      const splitRows = await ctx.db
        .select({
          categoryId: transaction.categoryId,
          categoryName: category.name,
          categoryIcon: category.icon,
          totalCents: sql<number>`coalesce(sum(${transaction.amount}), 0)`,
        })
        .from(transaction)
        .leftJoin(category, eq(category.id, transaction.categoryId))
        .where(
          and(
            eq(transaction.familyId, familyId),
            eq(transaction.accountId, input.id),
            eq(transaction.type, "expense"),
            eq(transaction.excludedFromCalculations, false),
            gte(transaction.date, fromStr),
            lte(transaction.date, toStr),
          ),
        )
        .groupBy(transaction.categoryId, category.name, category.icon);

      const categorySplit = splitRows
        .map((r) => ({
          categoryId: r.categoryId,
          categoryName: r.categoryName,
          categoryIcon: r.categoryIcon,
          totalCents: Number(r.totalCents),
        }))
        .sort((a, b) => b.totalCents - a.totalCents);

      const incomeCents = monthly.reduce((s, m) => s + m.incomeCents, 0);
      const expenseCents = monthly.reduce((s, m) => s + m.expenseCents, 0);

      return {
        windowFrom: fromStr,
        windowTo: toStr,
        months: input.months,
        monthly,
        categorySplit,
        totals: {
          incomeCents,
          expenseCents,
          netChangeCents: incomeCents - expenseCents,
        },
      };
    }),

  categorySplit: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const filter = await getAccessibleAccountFilter(
        ctx.db,
        familyId,
        ctx.session.user.id,
      );

      const [account] = await ctx.db
        .select({ id: financialAccount.id })
        .from(financialAccount)
        .where(and(filter, eq(financialAccount.id, input.id)));

      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const rows = await ctx.db
        .select({
          categoryId: transaction.categoryId,
          categoryName: category.name,
          categoryIcon: category.icon,
          totalCents: sql<number>`coalesce(sum(${transaction.amount}), 0)`,
        })
        .from(transaction)
        .leftJoin(category, eq(category.id, transaction.categoryId))
        .where(
          and(
            eq(transaction.familyId, familyId),
            eq(transaction.accountId, input.id),
            eq(transaction.type, "expense"),
            eq(transaction.excludedFromCalculations, false),
            gte(transaction.date, input.from),
            lte(transaction.date, input.to),
          ),
        )
        .groupBy(transaction.categoryId, category.name, category.icon);

      const entries = rows
        .map((r) => ({
          categoryId: r.categoryId,
          categoryName: r.categoryName,
          categoryIcon: r.categoryIcon,
          totalCents: Number(r.totalCents),
        }))
        .sort((a, b) => b.totalCents - a.totalCents);

      const totalCents = entries.reduce((s, e) => s + e.totalCents, 0);

      return { entries, totalCents };
    }),

  listAccess: protectedProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await assertUserCanEditAccount(
        ctx.db,
        familyId,
        ctx.session.user.id,
        input.accountId,
      );

      const rows = await ctx.db
        .select({ userId: financialAccountAccess.userId })
        .from(financialAccountAccess)
        .where(eq(financialAccountAccess.accountId, input.accountId));
      return rows.map((r) => r.userId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        identifier: z.string().min(1).max(50),
        type: z.enum([
          "checking",
          "savings",
          "gift",
          "financial_freedom",
          "fixed_costs",
          "investment",
          "other",
        ]),
        visibility: z.enum(["shared", "private"]).default("shared"),
        accessUserIds: z.array(z.string()).optional(),
        balance: z.number().int().default(0),
        includeInNetWorth: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      const [countRow] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(financialAccount)
        .where(eq(financialAccount.familyId, familyId));
      await requireWithinLimit(
        ctx.db,
        familyId,
        "maxAccounts",
        Number(countRow?.count ?? 0),
      );

      const [created] = await ctx.db
        .insert(financialAccount)
        .values({
          familyId,
          name: input.name,
          identifier: input.identifier,
          type: input.type,
          visibility: input.visibility,
          balance: input.balance,
          includeInNetWorth: input.includeInNetWorth,
        })
        .returning();

      if (input.visibility === "private" && created) {
        const targetUserIds = new Set<string>(input.accessUserIds ?? []);
        targetUserIds.add(ctx.session.user.id);
        const ids = Array.from(targetUserIds);
        await assertUsersInFamily(ctx.db, familyId, ids);
        await ctx.db.insert(financialAccountAccess).values(
          ids.map((userId) => ({ accountId: created.id, userId })),
        );
      }

      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        identifier: z.string().min(1).max(50).optional(),
        type: z
          .enum([
            "checking",
            "savings",
            "gift",
            "financial_freedom",
            "fixed_costs",
            "investment",
            "other",
          ])
          .optional(),
        visibility: z.enum(["shared", "private"]).optional(),
        accessUserIds: z.array(z.string()).optional(),
        includeInNetWorth: z.boolean().optional(),
        archived: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const { id, accessUserIds, visibility, ...data } = input;

      const existing = await assertUserCanEditAccount(
        ctx.db,
        familyId,
        ctx.session.user.id,
        id,
      );

      const nextVisibility = visibility ?? existing.visibility;

      await ctx.db
        .update(financialAccount)
        .set({
          ...data,
          ...(visibility !== undefined ? { visibility } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(financialAccount.id, id),
            eq(financialAccount.familyId, familyId),
          ),
        );

      if (visibility !== undefined || accessUserIds !== undefined) {
        if (nextVisibility === "shared") {
          await ctx.db
            .delete(financialAccountAccess)
            .where(eq(financialAccountAccess.accountId, id));
        } else {
          const targetUserIds = new Set<string>(accessUserIds ?? []);
          targetUserIds.add(ctx.session.user.id);
          const ids = Array.from(targetUserIds);
          await assertUsersInFamily(ctx.db, familyId, ids);
          await replaceAccessList(ctx.db, id, ids);
        }
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await assertUserCanEditAccount(
        ctx.db,
        familyId,
        ctx.session.user.id,
        input.id,
      );

      await ctx.db
        .delete(financialAccount)
        .where(
          and(
            eq(financialAccount.id, input.id),
            eq(financialAccount.familyId, familyId),
          ),
        );
    }),
});
