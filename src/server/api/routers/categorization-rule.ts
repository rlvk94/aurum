import { z } from "zod";
import { and, asc, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db as dbInstance } from "~/server/db";
import {
  categorizationRule,
  category,
  transaction,
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

/**
 * Find the matching category for a transaction description/note.
 * Returns the categoryId of the highest-priority matching rule, or null.
 *
 * Rules are matched (case-insensitive) against description + note.
 * Only applies to expense/income transactions (caller should filter transfers).
 */
export function findMatchingCategoryId(
  rules: Array<{
    pattern: string;
    categoryId: string;
    priority: number;
    categoryKind: "expense" | "income";
  }>,
  description: string,
  note: string | null,
  txType: "expense" | "income",
): string | null {
  const haystack = `${description}\n${note ?? ""}`.toLowerCase();

  // Rules come sorted by priority desc, createdAt asc (caller's responsibility)
  for (const rule of rules) {
    if (rule.categoryKind !== txType) continue;
    if (haystack.includes(rule.pattern.toLowerCase())) {
      return rule.categoryId;
    }
  }
  return null;
}

/**
 * Load all enabled rules for a family, joined with their category to know the kind.
 * Sorted by priority desc, createdAt asc — so iteration order = match order.
 */
export async function loadRulesWithKind(
  db: typeof dbInstance,
  familyId: string,
) {
  return db
    .select({
      pattern: categorizationRule.pattern,
      categoryId: categorizationRule.categoryId,
      priority: categorizationRule.priority,
      categoryKind: category.kind,
    })
    .from(categorizationRule)
    .innerJoin(category, eq(categorizationRule.categoryId, category.id))
    .where(
      and(
        eq(categorizationRule.familyId, familyId),
        eq(categorizationRule.enabled, true),
      ),
    )
    .orderBy(
      desc(categorizationRule.priority),
      asc(categorizationRule.createdAt),
    );
}

export const categorizationRuleRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    return ctx.db
      .select()
      .from(categorizationRule)
      .where(eq(categorizationRule.familyId, familyId))
      .orderBy(
        desc(categorizationRule.priority),
        asc(categorizationRule.createdAt),
      );
  }),

  create: protectedProcedure
    .input(
      z.object({
        pattern: z.string().min(1).max(200),
        categoryId: z.string().uuid(),
        priority: z.number().int().default(0),
        enabled: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      // Verify category belongs to this family
      const [cat] = await ctx.db
        .select({ id: category.id })
        .from(category)
        .where(
          and(
            eq(category.id, input.categoryId),
            eq(category.familyId, familyId),
          ),
        );
      if (!cat) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Category not found",
        });
      }

      const [created] = await ctx.db
        .insert(categorizationRule)
        .values({
          familyId,
          pattern: input.pattern.trim(),
          categoryId: input.categoryId,
          priority: input.priority,
          enabled: input.enabled,
        })
        .returning();

      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        pattern: z.string().min(1).max(200).optional(),
        categoryId: z.string().uuid().optional(),
        priority: z.number().int().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const { id, ...data } = input;

      if (data.categoryId) {
        const [cat] = await ctx.db
          .select({ id: category.id })
          .from(category)
          .where(
            and(
              eq(category.id, data.categoryId),
              eq(category.familyId, familyId),
            ),
          );
        if (!cat) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Category not found",
          });
        }
      }

      await ctx.db
        .update(categorizationRule)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(categorizationRule.id, id),
            eq(categorizationRule.familyId, familyId),
          ),
        );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await ctx.db
        .delete(categorizationRule)
        .where(
          and(
            eq(categorizationRule.id, input.id),
            eq(categorizationRule.familyId, familyId),
          ),
        );
    }),

  /**
   * Apply all enabled rules to uncategorized expense/income transactions in the family.
   * Returns the number of transactions that got a category assigned.
   */
  applyToExisting: protectedProcedure.mutation(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    const rules = await loadRulesWithKind(ctx.db, familyId);
    if (rules.length === 0) return { updated: 0 };

    const uncategorized = await ctx.db
      .select({
        id: transaction.id,
        description: transaction.description,
        note: transaction.note,
        type: transaction.type,
      })
      .from(transaction)
      .where(
        and(
          eq(transaction.familyId, familyId),
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
        rules,
        tx.description,
        tx.note,
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

  /**
   * Count how many uncategorized transactions would be affected by applying rules.
   * Useful for a preview before running applyToExisting.
   */
  previewApply: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    const rules = await loadRulesWithKind(ctx.db, familyId);
    if (rules.length === 0) return { matches: 0, uncategorized: 0 };

    const uncategorized = await ctx.db
      .select({
        description: transaction.description,
        note: transaction.note,
        type: transaction.type,
      })
      .from(transaction)
      .where(
        and(
          eq(transaction.familyId, familyId),
          isNull(transaction.categoryId),
          or(
            eq(transaction.type, "expense"),
            eq(transaction.type, "income"),
          ),
        ),
      );

    let matches = 0;
    for (const tx of uncategorized) {
      if (tx.type === "transfer") continue;
      if (findMatchingCategoryId(rules, tx.description, tx.note, tx.type)) {
        matches++;
      }
    }

    return { matches, uncategorized: uncategorized.length };
  }),
});
