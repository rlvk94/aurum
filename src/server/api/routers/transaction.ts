import { z } from "zod";
import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db as dbInstance } from "~/server/db";
import {
  financialAccount,
  financialAccountAccess,
  transaction,
  user,
} from "~/server/db/schema";
import { getPostHogClient } from "~/server/posthog";
import {
  findMatchingCategoryId,
  loadCategoriesWithKeywords,
} from "./category";

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

const transactionTypeSchema = z.enum(["expense", "income", "transfer"]);

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
          categoryId: z.string().uuid().nullable().optional(),
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
      ];

      if (input?.accountId) {
        // Include transactions where this account is either the source OR the transfer destination
        const accountCondition = or(
          eq(transaction.accountId, input.accountId),
          eq(transaction.transferAccountId, input.accountId),
        );
        if (accountCondition) conditions.push(accountCondition);
      }
      if (input?.type) {
        conditions.push(eq(transaction.type, input.type));
      }
      if (input?.categoryId !== undefined) {
        conditions.push(
          input.categoryId === null
            ? isNull(transaction.categoryId)
            : eq(transaction.categoryId, input.categoryId),
        );
      }
      if (input?.search && input.search.trim()) {
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
        conditions.push(
          sql`(${transaction.date}, ${transaction.createdAt}, ${transaction.id}) < (${input.cursor.date}, ${new Date(input.cursor.createdAt)}, ${input.cursor.id})`,
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
      z
        .object({
          accountId: z.string().uuid(),
          type: transactionTypeSchema,
          amount: z.number().int().positive(),
          date: z.string(), // YYYY-MM-DD
          description: z.string().min(1).max(500),
          note: z.string().max(1000).optional(),
          transferAccountId: z.string().uuid().optional(),
          categoryId: z.string().uuid().optional(),
        })
        .refine(
          (data) => data.type !== "transfer" || !!data.transferAccountId,
          {
            message: "transferAccountId is required for transfers",
            path: ["transferAccountId"],
          },
        )
        .refine(
          (data) => data.type === "transfer" || !data.transferAccountId,
          {
            message: "transferAccountId only applies to transfers",
            path: ["transferAccountId"],
          },
        )
        .refine((data) => data.type !== "transfer" || !data.categoryId, {
          message: "categoryId does not apply to transfers",
          path: ["categoryId"],
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await assertAccountAccess(
        ctx.db,
        familyId,
        ctx.session.user.id,
        [input.accountId, ...(input.transferAccountId ? [input.transferAccountId] : [])],
      );

      const [created] = await ctx.db
        .insert(transaction)
        .values({
          familyId,
          accountId: input.accountId,
          transferAccountId: input.transferAccountId ?? null,
          type: input.type,
          amount: input.amount,
          date: input.date,
          description: input.description,
          note: input.note ?? null,
          categoryId: input.categoryId ?? null,
        })
        .returning();

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
              transferAccountId: z.string().uuid().optional(),
            }),
          )
          .min(1)
          .max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      // Collect all unique account IDs referenced by the rows
      const allAccountIds = new Set<string>();
      for (const t of input.transactions) {
        allAccountIds.add(t.accountId);
        if (t.transferAccountId) allAccountIds.add(t.transferAccountId);
      }

      await assertAccountAccess(
        ctx.db,
        familyId,
        ctx.session.user.id,
        Array.from(allAccountIds),
      );

      // Load categories with keywords once and apply to each row
      const categoriesWithKeywords = await loadCategoriesWithKeywords(
        ctx.db,
        familyId,
      );

      const now = new Date();
      const values = input.transactions.map((t) => {
        const description = stripNullBytes(t.description);
        const note = t.note ? stripNullBytes(t.note) : null;
        const metadata = sanitizeMetadata(t.metadata);
        const categoryId =
          t.type !== "transfer"
            ? findMatchingCategoryId(
                categoriesWithKeywords,
                description,
                note,
                metadata,
                t.type,
              )
            : null;
        return {
          familyId,
          accountId: t.accountId,
          transferAccountId: t.transferAccountId ?? null,
          type: t.type,
          amount: t.amount,
          date: t.date,
          description,
          note,
          metadata,
          categoryId,
          externalId: stripNullBytes(t.externalId),
          importedAt: now,
        };
      });

      // Insert atomically in chunks so a mid-loop failure can't leave
      // partial data behind.
      const CHUNK = 500;
      let inserted = 0;
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
              .returning({ id: transaction.id });
            inserted += result.length;
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
        transferAccountId: z.string().uuid().nullable().optional(),
        categoryId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const { id, ...data } = input;

      const [existing] = await ctx.db
        .select({ accountId: transaction.accountId })
        .from(transaction)
        .where(
          and(eq(transaction.id, id), eq(transaction.familyId, familyId)),
        );

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await assertAccountAccess(
        ctx.db,
        familyId,
        ctx.session.user.id,
        [
          existing.accountId,
          ...(data.transferAccountId ? [data.transferAccountId] : []),
        ],
      );

      await ctx.db
        .update(transaction)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(eq(transaction.id, id), eq(transaction.familyId, familyId)),
        );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      const [existing] = await ctx.db
        .select({ accountId: transaction.accountId })
        .from(transaction)
        .where(
          and(eq(transaction.id, input.id), eq(transaction.familyId, familyId)),
        );

      if (!existing) return;
      await assertAccountAccess(
        ctx.db,
        familyId,
        ctx.session.user.id,
        [existing.accountId],
      );

      await ctx.db
        .delete(transaction)
        .where(
          and(eq(transaction.id, input.id), eq(transaction.familyId, familyId)),
        );
    }),
});
