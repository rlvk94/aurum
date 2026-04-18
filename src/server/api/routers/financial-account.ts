import { z } from "zod";
import { and, asc, eq, or, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db as dbInstance } from "~/server/db";
import {
  financialAccount,
  financialAccountAccess,
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
