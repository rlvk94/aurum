import { z } from "zod";
import { and, desc, eq, gte, ilike, inArray, isNotNull, lte, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db as dbInstance } from "~/server/db";
import {
  financialAccount,
  financialAccountAccess,
  transaction,
  user,
} from "~/server/db/schema";

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

export const transactionRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          accountId: z.string().uuid().optional(),
          type: transactionTypeSchema.optional(),
          search: z.string().optional(),
          from: z.string().optional(), // ISO date YYYY-MM-DD
          to: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(100),
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

      if (accessibleIds.length === 0) return [];

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

      return ctx.db
        .select()
        .from(transaction)
        .where(and(...conditions))
        .orderBy(desc(transaction.date), desc(transaction.createdAt))
        .limit(input?.limit ?? 100);
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
        ),
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

      const now = new Date();
      const values = input.transactions.map((t) => ({
        familyId,
        accountId: t.accountId,
        transferAccountId: t.transferAccountId ?? null,
        type: t.type,
        amount: t.amount,
        date: t.date,
        description: t.description,
        note: t.note ?? null,
        externalId: t.externalId,
        importedAt: now,
      }));

      // Insert in chunks to avoid query size limits
      const CHUNK = 500;
      let inserted = 0;
      for (let i = 0; i < values.length; i += CHUNK) {
        const chunk = values.slice(i, i + CHUNK);
        const result = await ctx.db
          .insert(transaction)
          .values(chunk)
          .onConflictDoNothing({
            target: [transaction.accountId, transaction.externalId],
            where: isNotNull(transaction.externalId),
          })
          .returning({ id: transaction.id });
        inserted += result.length;
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
