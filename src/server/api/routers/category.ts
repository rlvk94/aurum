import { z } from "zod";
import { and, asc, eq, inArray, isNull, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db as dbInstance } from "~/server/db";
import {
  category,
  financialAccount,
  financialAccountAccess,
  transaction,
  user,
} from "~/server/db/schema";

const keywordsSchema = z.array(z.string().min(1).max(100)).max(50);

type CategoryWithKeywords = {
  id: string;
  keywords: string[];
};

/**
 * Find the matching category for a transaction based on keywords.
 * Builds keyword→category pairs sorted by keyword length desc (longest/most specific first).
 * Matches case-insensitively against description + note + metadata values.
 */
export function findMatchingCategoryId(
  categories: CategoryWithKeywords[],
  description: string,
  note: string | null,
  metadata: Record<string, string> | null,
): string | null {
  const parts = [description, note ?? ""];
  if (metadata) parts.push(...Object.values(metadata));
  const haystack = parts.join("\n").toLowerCase();

  const pairs: Array<{ keyword: string; categoryId: string }> = [];
  for (const cat of categories) {
    for (const kw of cat.keywords) {
      pairs.push({ keyword: kw.toLowerCase(), categoryId: cat.id });
    }
  }
  pairs.sort((a, b) => b.keyword.length - a.keyword.length);

  for (const { keyword, categoryId } of pairs) {
    if (haystack.includes(keyword)) {
      return categoryId;
    }
  }
  return null;
}

/**
 * Load all non-archived leaf categories with keywords for a family. Parents
 * are excluded so auto-categorization can never assign a transaction to a
 * top-level category.
 */
export async function loadCategoriesWithKeywords(
  db: typeof dbInstance,
  familyId: string,
): Promise<CategoryWithKeywords[]> {
  const child = alias(category, "child_cat");
  const rows = await db
    .select({
      id: category.id,
      keywords: category.keywords,
    })
    .from(category)
    .where(
      and(
        eq(category.familyId, familyId),
        eq(category.archived, false),
        notExists(
          db.select({ one: sql`1` }).from(child).where(eq(child.parentId, category.id)),
        ),
      ),
    );

  return rows.filter((r) => r.keywords.length > 0);
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
        keywords: keywordsSchema.optional(),
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
          keywords: input.keywords ?? [],
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
        keywords: keywordsSchema.optional(),
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

  applyKeywords: protectedProcedure.mutation(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    const cats = await loadCategoriesWithKeywords(ctx.db, familyId);
    if (cats.length === 0) return { updated: 0 };

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
        note: transaction.note,
        metadata: transaction.metadata,
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
      const matched = findMatchingCategoryId(
        cats,
        tx.description,
        tx.note,
        tx.metadata,
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
});
