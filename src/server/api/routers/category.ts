import { z } from "zod";
import { and, asc, eq, inArray, isNull, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { type db as dbInstance } from "~/server/db";
import {
  categorizationRule,
  category,
  financialAccount,
  financialAccountAccess,
  transaction,
  user,
  usersToFamilies,
} from "~/server/db/schema";
import {
  deriveMerchantKey,
  indexLearnedRules,
  ruleCategoryFor,
  type LearnedRule,
} from "~/server/categorization";
import { reseedRulesForCategories } from "~/server/db/seeds/seed-categories";

/**
 * Load a family's learned merchant→category rules, restricted to rules whose
 * target category is still a non-archived LEAF (a category may have been
 * archived or gained children since the rule was learned — such rules are
 * ignored, never assigned).
 */
export async function loadLearnedRules(
  db: typeof dbInstance,
  familyId: string,
): Promise<LearnedRule[]> {
  const child = alias(category, "child_cat");
  return db
    .select({
      merchantKey: categorizationRule.merchantKey,
      categoryId: categorizationRule.categoryId,
      hitCount: categorizationRule.hitCount,
      conflictCount: categorizationRule.conflictCount,
    })
    .from(categorizationRule)
    .innerJoin(category, eq(category.id, categorizationRule.categoryId))
    .where(
      and(
        eq(categorizationRule.familyId, familyId),
        eq(category.archived, false),
        notExists(
          db
            .select({ one: sql`1` })
            .from(child)
            .where(eq(child.parentId, category.id)),
        ),
      ),
    );
}

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

export const categoryRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    return ctx.db
      .select()
      .from(category)
      .where(eq(category.familyId, familyId))
      .orderBy(asc(sql`lower(${category.name})`));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        parentId: z.string().uuid().nullable().optional(),
        icon: z.string().max(16).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      // If parentId is set, parent must exist in the family and be top-level.
      if (input.parentId) {
        const [parent] = await ctx.db
          .select({
            id: category.id,
            parentId: category.parentId,
          })
          .from(category)
          .where(
            and(
              eq(category.id, input.parentId),
              eq(category.familyId, familyId),
            ),
          );
        if (!parent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Parent category not found",
          });
        }
        if (parent.parentId !== null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only two levels of hierarchy are allowed",
          });
        }
      }

      const [created] = await ctx.db
        .insert(category)
        .values({
          familyId,
          name: input.name.trim(),
          parentId: input.parentId ?? null,
          icon: input.icon ?? null,
        })
        .returning();

      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        parentId: z.string().uuid().nullable().optional(),
        icon: z.string().max(16).nullable().optional(),
        archived: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      const [existing] = await ctx.db
        .select({
          id: category.id,
          parentId: category.parentId,
        })
        .from(category)
        .where(
          and(eq(category.id, input.id), eq(category.familyId, familyId)),
        );

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // If assigning a parent: ensure parent exists, is top-level, and this
      // category doesn't already have children.
      if (input.parentId) {
        if (input.parentId === input.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Category cannot be its own parent",
          });
        }

        const [parent] = await ctx.db
          .select({
            parentId: category.parentId,
          })
          .from(category)
          .where(
            and(
              eq(category.id, input.parentId),
              eq(category.familyId, familyId),
            ),
          );
        if (!parent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Parent category not found",
          });
        }
        if (parent.parentId !== null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only two levels of hierarchy are allowed",
          });
        }

        const [childCount] = await ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(category)
          .where(eq(category.parentId, input.id));
        if (childCount && Number(childCount.count) > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot nest a category that already has children",
          });
        }
      }

      const { id, ...data } = input;

      await ctx.db
        .update(category)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(category.id, id), eq(category.familyId, familyId)));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      await ctx.db
        .delete(category)
        .where(and(eq(category.id, input.id), eq(category.familyId, familyId)));
    }),

  autoCategorize: protectedProcedure.mutation(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    const learnedIndex = indexLearnedRules(
      await loadLearnedRules(ctx.db, familyId),
    );
    if (learnedIndex.size === 0) return { updated: 0 };

    const accessRows = await ctx.db
      .select({ accountId: financialAccountAccess.accountId })
      .from(financialAccountAccess)
      .where(eq(financialAccountAccess.userId, ctx.session.user.id));
    const privateIds = accessRows.map((r) => r.accountId);
    const accessibleAccounts = await ctx.db
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
    if (accessibleAccounts.length === 0) return { updated: 0 };

    const uncategorized = await ctx.db
      .select({
        id: transaction.id,
        description: transaction.description,
        metadata: transaction.metadata,
        transferGroupId: transaction.transferGroupId,
      })
      .from(transaction)
      .where(
        and(
          eq(transaction.familyId, familyId),
          inArray(
            transaction.accountId,
            accessibleAccounts.map((a) => a.id),
          ),
          isNull(transaction.categoryId),
        ),
      );

    let updated = 0;
    for (const tx of uncategorized) {
      if (tx.transferGroupId) continue;
      const matched = ruleCategoryFor(
        learnedIndex,
        deriveMerchantKey(tx.description, tx.metadata),
      );
      if (matched) {
        await ctx.db
          .update(transaction)
          .set({ categoryId: matched, updatedAt: new Date() })
          .where(eq(transaction.id, tx.id));
        updated++;
      }
    }

    return { updated };
  }),

  /**
   * Owner-only: delete all of the family's categorization rules and re-seed the
   * defaults against its current categories — leaving rule state as it would be
   * for a brand-new family. Learned corrections are wiped; seeded defaults
   * return.
   */
  resetRules: protectedProcedure.mutation(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

    const [membership] = await ctx.db
      .select({ role: usersToFamilies.role })
      .from(usersToFamilies)
      .where(
        and(
          eq(usersToFamilies.userId, ctx.session.user.id),
          eq(usersToFamilies.familyId, familyId),
        ),
      );
    if (membership?.role !== "owner") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Owner role required",
      });
    }

    const child = alias(category, "child_cat");
    const rules = await ctx.db.transaction(async (tx) => {
      await tx
        .delete(categorizationRule)
        .where(eq(categorizationRule.familyId, familyId));

      const leaves = await tx
        .select({ id: category.id, name: category.name })
        .from(category)
        .where(
          and(
            eq(category.familyId, familyId),
            eq(category.archived, false),
            notExists(
              tx
                .select({ one: sql`1` })
                .from(child)
                .where(eq(child.parentId, category.id)),
            ),
          ),
        );

      return reseedRulesForCategories(tx, familyId, leaves);
    });

    return { rules };
  }),
});
