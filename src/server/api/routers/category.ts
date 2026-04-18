import { z } from "zod";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
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

const kindSchema = z.enum(["expense", "income"]);
const keywordsSchema = z.array(z.string().min(1).max(100)).max(50);

type CategoryWithKeywords = {
  id: string;
  kind: "expense" | "income";
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
  txType: "expense" | "income",
): string | null {
  const parts = [description, note ?? ""];
  if (metadata) parts.push(...Object.values(metadata));
  const haystack = parts.join("\n").toLowerCase();

  // Build pairs sorted by keyword length desc — longest match wins
  const pairs: Array<{ keyword: string; categoryId: string }> = [];
  for (const cat of categories) {
    if (cat.kind !== txType) continue;
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
 * Load all non-archived categories with keywords for a family.
 */
export async function loadCategoriesWithKeywords(
  db: typeof dbInstance,
  familyId: string,
): Promise<CategoryWithKeywords[]> {
  const rows = await db
    .select({
      id: category.id,
      kind: category.kind,
      keywords: category.keywords,
    })
    .from(category)
    .where(and(eq(category.familyId, familyId), eq(category.archived, false)));

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
        kind: kindSchema,
        parentId: z.string().uuid().nullable().optional(),
        icon: z.string().max(16).nullable().optional(),
        keywords: keywordsSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      // If parentId is set, enforce: parent must exist in the family,
      // be top-level (no parent of its own), and have the same kind.
      if (input.parentId) {
        const [parent] = await ctx.db
          .select({
            id: category.id,
            parentId: category.parentId,
            kind: category.kind,
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
        if (parent.kind !== input.kind) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Child must have the same kind as parent",
          });
        }
      }

      const [created] = await ctx.db
        .insert(category)
        .values({
          familyId,
          name: input.name.trim(),
          kind: input.kind,
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
          kind: category.kind,
        })
        .from(category)
        .where(
          and(eq(category.id, input.id), eq(category.familyId, familyId)),
        );

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // If assigning a parent: ensure parent exists in the family, is top-level,
      // matches kind, and this category itself has no children.
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
            kind: category.kind,
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
        if (parent.kind !== existing.kind) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Child must have the same kind as parent",
          });
        }

        // Ensure this category has no children (can't become a child if it's already a parent)
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

    // Only re-categorize transactions on accounts this user can access, so
    // a bulk categorize never reaches into another member's private account.
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
        type: transaction.type,
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
          or(
            eq(transaction.type, "expense"),
            eq(transaction.type, "income"),
          ),
        ),
      );

    let updated = 0;
    for (const tx of uncategorized) {
      if (tx.type === "transfer") continue;
      const matched = findMatchingCategoryId(
        cats,
        tx.description,
        tx.note,
        tx.metadata,
        tx.type,
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
