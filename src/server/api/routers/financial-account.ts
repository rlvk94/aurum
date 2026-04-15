import { z } from "zod";
import { and, asc, eq, or, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db as dbInstance } from "~/server/db";
import {
  financialAccount,
  financialAccountAccess,
  user,
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
        balance: z.number().int().default(0),
        includeInNetWorth: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

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

      // If private, grant access to the creator
      if (input.visibility === "private" && created) {
        await ctx.db.insert(financialAccountAccess).values({
          accountId: created.id,
          userId: ctx.session.user.id,
        });
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
        includeInNetWorth: z.boolean().optional(),
        archived: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const { id, ...data } = input;

      await ctx.db
        .update(financialAccount)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(financialAccount.id, id),
            eq(financialAccount.familyId, familyId),
          ),
        );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

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
