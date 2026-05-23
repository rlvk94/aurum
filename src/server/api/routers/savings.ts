import { z } from "zod";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db as dbInstance } from "~/server/db";
import {
  financialAccount,
  financialAccountAccess,
  savings,
  savingsTransaction,
  user,
} from "~/server/db/schema";
import { PROJECT_PALETTES } from "./project";

type DbOrTx =
  | typeof dbInstance
  | Parameters<Parameters<typeof dbInstance.transaction>[0]>[0];

// Rounding step in cents. Maps to 5/10/50/100 kr UI options.
const ROUNDING_STEPS = [500, 1000, 5000, 10000] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const emojiSchema = z.string().min(1).max(8);
const colorSchema = z.enum(PROJECT_PALETTES);
const transferModeSchema = z.enum(["manual", "monthly_fixed", "rounding"]);
const roundingStepSchema = z.union([
  z.literal(500),
  z.literal(1000),
  z.literal(5000),
  z.literal(10000),
]);

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

async function getAccessibleAccountIds(
  db: typeof dbInstance,
  familyId: string,
  userId: string,
): Promise<string[]> {
  const accessRows = await db
    .select({ accountId: financialAccountAccess.accountId })
    .from(financialAccountAccess)
    .where(eq(financialAccountAccess.userId, userId));

  const privateIds = accessRows.map((r) => r.accountId);

  const rows = await db
    .select({
      id: financialAccount.id,
      visibility: financialAccount.visibility,
    })
    .from(financialAccount)
    .where(eq(financialAccount.familyId, familyId));

  const privateSet = new Set(privateIds);
  return rows
    .filter(
      (r) => r.visibility === "shared" || privateSet.has(r.id),
    )
    .map((r) => r.id);
}

async function assertAccountAccess(
  db: typeof dbInstance,
  familyId: string,
  userId: string,
  accountId: string,
) {
  const accessible = await getAccessibleAccountIds(db, familyId, userId);
  if (!accessible.includes(accountId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No access to this account",
    });
  }
}

async function getSavingsForUser(
  db: typeof dbInstance,
  familyId: string,
  userId: string,
  savingsId: string,
) {
  const accessibleIds = await getAccessibleAccountIds(db, familyId, userId);
  if (accessibleIds.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  const [row] = await db
    .select()
    .from(savings)
    .where(
      and(
        eq(savings.id, savingsId),
        eq(savings.familyId, familyId),
        inArray(savings.accountId, accessibleIds),
      ),
    );
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  return row;
}

function validateModeFields(input: {
  transferMode: "manual" | "monthly_fixed" | "rounding";
  monthlyAmount?: number | null;
  roundingStep?: number | null;
}) {
  if (input.transferMode === "monthly_fixed") {
    if (!input.monthlyAmount || input.monthlyAmount <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Monthly amount required for monthly_fixed mode",
      });
    }
  }
  if (input.transferMode === "rounding") {
    if (!input.roundingStep || !ROUNDING_STEPS.includes(input.roundingStep as (typeof ROUNDING_STEPS)[number])) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Valid rounding step required for rounding mode",
      });
    }
  }
}

/**
 * Insert a savings_transaction row and update the parent savings.balance.
 * If the new balance meets or exceeds the target and the goal has not yet
 * been marked complete, auto-pause and stamp completedAt.
 */
export async function applySavingsMovement(
  tx: DbOrTx,
  args: {
    savingsId: string;
    accountId: string;
    familyId: string;
    amount: number; // signed cents
    source:
      | "manual"
      | "monthly_auto"
      | "rounding_auto"
      | "withdraw"
      | "archive_return";
    date: string;
    triggeringTransactionId?: string | null;
    note?: string | null;
  },
): Promise<void> {
  await tx.insert(savingsTransaction).values({
    savingsId: args.savingsId,
    accountId: args.accountId,
    familyId: args.familyId,
    amount: args.amount,
    source: args.source,
    date: args.date,
    triggeringTransactionId: args.triggeringTransactionId ?? null,
    note: args.note ?? null,
  });

  const [updated] = await tx
    .update(savings)
    .set({
      balance: sql`${savings.balance} + ${args.amount}`,
      updatedAt: new Date(),
    })
    .where(eq(savings.id, args.savingsId))
    .returning({
      balance: savings.balance,
      targetAmount: savings.targetAmount,
      completedAt: savings.completedAt,
    });

  if (
    updated &&
    !updated.completedAt &&
    updated.balance >= updated.targetAmount
  ) {
    const now = new Date();
    await tx
      .update(savings)
      .set({ completedAt: now, pausedAt: now, updatedAt: now })
      .where(eq(savings.id, args.savingsId));
  }
}

export const savingsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          accountId: z.string().uuid().optional(),
          includeArchived: z.boolean().optional(),
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
        eq(savings.familyId, familyId),
        inArray(savings.accountId, accessibleIds),
      ];
      if (input?.accountId) {
        conditions.push(eq(savings.accountId, input.accountId));
      }
      if (!input?.includeArchived) {
        conditions.push(eq(savings.archived, false));
      }

      const rows = await ctx.db
        .select()
        .from(savings)
        .where(and(...conditions))
        .orderBy(asc(savings.createdAt));

      return rows;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      return getSavingsForUser(
        ctx.db,
        familyId,
        ctx.session.user.id,
        input.id,
      );
    }),

  /**
   * Map of accountId → sum of non-archived savings balances on that account.
   * UI subtracts this from financial_account.balance to render the visual
   * balance. Net worth uses the raw balance and is unaffected.
   */
  reservedByAccount: protectedProcedure
    .input(
      z.object({ accountIds: z.array(z.string().uuid()).optional() }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const accessibleIds = await getAccessibleAccountIds(
        ctx.db,
        familyId,
        ctx.session.user.id,
      );

      if (accessibleIds.length === 0) {
        return {} as Record<string, number>;
      }

      const filterIds =
        input?.accountIds && input.accountIds.length > 0
          ? input.accountIds.filter((id) => accessibleIds.includes(id))
          : accessibleIds;

      if (filterIds.length === 0) return {} as Record<string, number>;

      const rows = await ctx.db
        .select({
          accountId: savings.accountId,
          total: sql<number>`coalesce(sum(${savings.balance}), 0)`,
        })
        .from(savings)
        .where(
          and(
            eq(savings.familyId, familyId),
            inArray(savings.accountId, filterIds),
            eq(savings.archived, false),
          ),
        )
        .groupBy(savings.accountId);

      const out: Record<string, number> = {};
      for (const r of rows) {
        out[r.accountId] = Number(r.total);
      }
      return out;
    }),

  create: protectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        name: z.string().min(1).max(100),
        emoji: emojiSchema,
        color: colorSchema,
        targetAmount: z.number().int().positive(),
        transferMode: transferModeSchema,
        monthlyAmount: z.number().int().positive().nullable().optional(),
        roundingStep: roundingStepSchema.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await assertAccountAccess(
        ctx.db,
        familyId,
        ctx.session.user.id,
        input.accountId,
      );

      validateModeFields({
        transferMode: input.transferMode,
        monthlyAmount: input.monthlyAmount ?? null,
        roundingStep: input.roundingStep ?? null,
      });

      const [created] = await ctx.db
        .insert(savings)
        .values({
          familyId,
          accountId: input.accountId,
          name: input.name,
          emoji: input.emoji,
          color: input.color,
          targetAmount: input.targetAmount,
          transferMode: input.transferMode,
          monthlyAmount:
            input.transferMode === "monthly_fixed"
              ? (input.monthlyAmount ?? null)
              : null,
          roundingStep:
            input.transferMode === "rounding"
              ? (input.roundingStep ?? null)
              : null,
        })
        .returning();

      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        emoji: emojiSchema.optional(),
        color: colorSchema.optional(),
        targetAmount: z.number().int().positive().optional(),
        transferMode: transferModeSchema.optional(),
        monthlyAmount: z.number().int().positive().nullable().optional(),
        roundingStep: roundingStepSchema.nullable().optional(),
        paused: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const existing = await getSavingsForUser(
        ctx.db,
        familyId,
        ctx.session.user.id,
        input.id,
      );

      const nextMode = input.transferMode ?? existing.transferMode;
      const nextMonthly =
        input.monthlyAmount !== undefined
          ? input.monthlyAmount
          : existing.monthlyAmount;
      const nextRounding =
        input.roundingStep !== undefined
          ? input.roundingStep
          : existing.roundingStep;

      validateModeFields({
        transferMode: nextMode,
        monthlyAmount: nextMonthly,
        roundingStep: nextRounding,
      });

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) patch.name = input.name;
      if (input.emoji !== undefined) patch.emoji = input.emoji;
      if (input.color !== undefined) patch.color = input.color;
      if (input.targetAmount !== undefined) {
        patch.targetAmount = input.targetAmount;
      }
      if (input.transferMode !== undefined) {
        patch.transferMode = input.transferMode;
        // Clear the field for the unused mode so we never have stale data.
        patch.monthlyAmount =
          input.transferMode === "monthly_fixed"
            ? (nextMonthly ?? null)
            : null;
        patch.roundingStep =
          input.transferMode === "rounding" ? (nextRounding ?? null) : null;
      } else {
        if (input.monthlyAmount !== undefined) {
          patch.monthlyAmount = input.monthlyAmount;
        }
        if (input.roundingStep !== undefined) {
          patch.roundingStep = input.roundingStep;
        }
      }
      if (input.paused !== undefined) {
        patch.pausedAt = input.paused ? new Date() : null;
      }

      await ctx.db
        .update(savings)
        .set(patch)
        .where(eq(savings.id, input.id));
    }),

  deposit: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        amount: z.number().int().positive(),
        note: z.string().max(500).optional(),
        date: isoDate.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const existing = await getSavingsForUser(
        ctx.db,
        familyId,
        ctx.session.user.id,
        input.id,
      );
      const today = input.date ?? new Date().toISOString().slice(0, 10);

      await applySavingsMovement(ctx.db, {
        savingsId: existing.id,
        accountId: existing.accountId,
        familyId,
        amount: input.amount,
        source: "manual",
        date: today,
        note: input.note ?? null,
      });
    }),

  withdraw: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        amount: z.number().int().positive(),
        note: z.string().max(500).optional(),
        date: isoDate.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const existing = await getSavingsForUser(
        ctx.db,
        familyId,
        ctx.session.user.id,
        input.id,
      );
      if (input.amount > existing.balance) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Withdraw amount exceeds savings balance",
        });
      }
      const today = input.date ?? new Date().toISOString().slice(0, 10);

      await applySavingsMovement(ctx.db, {
        savingsId: existing.id,
        accountId: existing.accountId,
        familyId,
        amount: -input.amount,
        source: "withdraw",
        date: today,
        note: input.note ?? null,
      });
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const existing = await getSavingsForUser(
        ctx.db,
        familyId,
        ctx.session.user.id,
        input.id,
      );

      await ctx.db.transaction(async (tx) => {
        if (existing.balance !== 0) {
          await applySavingsMovement(tx, {
            savingsId: existing.id,
            accountId: existing.accountId,
            familyId,
            amount: -existing.balance,
            source: "archive_return",
            date: new Date().toISOString().slice(0, 10),
          });
        }
        await tx
          .update(savings)
          .set({
            archived: true,
            pausedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(savings.id, existing.id));
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const existing = await getSavingsForUser(
        ctx.db,
        familyId,
        ctx.session.user.id,
        input.id,
      );

      // Cascade removes savings_transaction rows via FK ON DELETE CASCADE.
      await ctx.db.delete(savings).where(eq(savings.id, existing.id));
    }),

  listTransactions: protectedProcedure
    .input(
      z.object({
        savingsId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
        cursor: z
          .object({
            date: z.string(),
            createdAt: z.string(),
            id: z.string().uuid(),
          })
          .nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      // Access check via parent savings.
      await getSavingsForUser(
        ctx.db,
        familyId,
        ctx.session.user.id,
        input.savingsId,
      );

      const conditions = [eq(savingsTransaction.savingsId, input.savingsId)];
      if (input.cursor) {
        conditions.push(
          sql`(${savingsTransaction.date}, ${savingsTransaction.createdAt}, ${savingsTransaction.id}) < (${input.cursor.date}::date, ${input.cursor.createdAt}::timestamptz, ${input.cursor.id}::uuid)`,
        );
      }

      const rows = await ctx.db
        .select()
        .from(savingsTransaction)
        .where(and(...conditions))
        .orderBy(
          desc(savingsTransaction.date),
          desc(savingsTransaction.createdAt),
          desc(savingsTransaction.id),
        )
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
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
});

// Re-export for cron and other server consumers that need to read savings
// rows scoped to a family (e.g. monthly auto-transfer).
export async function listFamilyMonthlySavings(
  db: typeof dbInstance,
): Promise<Array<typeof savings.$inferSelect>> {
  return db
    .select()
    .from(savings)
    .where(
      and(
        eq(savings.transferMode, "monthly_fixed"),
        eq(savings.archived, false),
        isNull(savings.pausedAt),
      ),
    );
}
