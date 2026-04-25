import { z } from "zod";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { requireFeature } from "~/server/billing/entitlements";
import type { db as dbInstance } from "~/server/db";
import {
  category,
  challenge,
  challengeAccount,
  challengeCategory,
  challengeInstance,
  debt,
  financialAccount,
  financialAccountAccess,
  user,
} from "~/server/db/schema";
import {
  computeProgress,
  rotateChallenge,
  todayIso,
} from "~/server/lib/challenge-service";
import {
  computePeriodWindow,
  type Repetition,
} from "~/server/lib/challenge-period";

export { computePeriodWindow };
export type { Repetition };

// ── Validation schemas ──────────────────────────────────────────────────────

const challengeTypeSchema = z.enum([
  "spend_less",
  "savings",
  "pay_off_loan",
  "net_worth_goal",
]);

const challengeRepetitionSchema = z.enum([
  "one_off",
  "weekly",
  "monthly",
  "yearly",
  "custom",
]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000).optional(),
    type: challengeTypeSchema,
    repetition: challengeRepetitionSchema,
    startDate: isoDate,
    endDate: isoDate.nullable().optional(),
    customDurationDays: z.number().int().min(1).max(3650).nullable().optional(),
    targetAmount: z.number().int().positive(),
    categoryIds: z.array(z.string().uuid()).optional(),
    accountId: z.string().uuid().nullable().optional(),
    debtId: z.string().uuid().nullable().optional(),
    accountIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.repetition === "one_off") {
      if (!data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "endDate is required for one-off challenges",
          path: ["endDate"],
        });
      }
    }
    if (data.repetition === "custom" && !data.customDurationDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "customDurationDays is required for custom repetition",
        path: ["customDurationDays"],
      });
    }
    if (
      data.type === "spend_less" &&
      (!data.categoryIds || data.categoryIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one categoryId is required for spend-less challenges",
        path: ["categoryIds"],
      });
    }
    if (data.type === "savings" && !data.accountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "accountId is required for savings challenges",
        path: ["accountId"],
      });
    }
    if (
      data.type === "pay_off_loan" &&
      (!data.categoryIds || data.categoryIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "At least one categoryId is required for pay-off-loan challenges",
        path: ["categoryIds"],
      });
    }
    if (data.type === "net_worth_goal") {
      if (data.repetition !== "one_off") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "net_worth_goal challenges must be one-off",
          path: ["repetition"],
        });
      }
      if (!data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "endDate is required for net_worth_goal challenges",
          path: ["endDate"],
        });
      }
    }
  });

// ── Helpers ─────────────────────────────────────────────────────────────────

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
): Promise<Set<string>> {
  const accessRows = await db
    .select({ accountId: financialAccountAccess.accountId })
    .from(financialAccountAccess)
    .where(eq(financialAccountAccess.userId, userId));
  const privateIds = accessRows.map((r) => r.accountId);

  const rows = await db
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
  return new Set(rows.map((r) => r.id));
}

async function assertAccountsAccessible(
  db: typeof dbInstance,
  familyId: string,
  userId: string,
  accountIds: string[],
) {
  if (accountIds.length === 0) return;
  const accessible = await getAccessibleAccountIds(db, familyId, userId);
  for (const id of accountIds) {
    if (!accessible.has(id)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No access to one or more referenced accounts",
      });
    }
  }
}

async function assertCategoriesInFamily(
  db: typeof dbInstance,
  familyId: string,
  categoryIds: string[],
) {
  if (categoryIds.length === 0) return;
  const rows = await db
    .select({ id: category.id })
    .from(category)
    .where(
      and(
        inArray(category.id, categoryIds),
        eq(category.familyId, familyId),
      ),
    );
  if (rows.length !== new Set(categoryIds).size) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "One or more categories not found in this family",
    });
  }
}

async function assertFamilyResource(
  db: typeof dbInstance,
  familyId: string,
  userId: string,
  opts: {
    accountId?: string | null;
    debtId?: string | null;
  },
) {
  if (opts.accountId) {
    await assertAccountsAccessible(db, familyId, userId, [opts.accountId]);
  }
  if (opts.debtId) {
    const [row] = await db
      .select({ id: debt.id })
      .from(debt)
      .where(and(eq(debt.id, opts.debtId), eq(debt.familyId, familyId)));
    if (!row) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Debt not found in this family",
      });
    }
  }
}

function isChallengeVisible(
  row: typeof challenge.$inferSelect,
  scopedAccountIds: string[],
  accessible: Set<string>,
): boolean {
  if (row.type === "savings" && row.accountId) {
    if (!accessible.has(row.accountId)) return false;
  }
  for (const accountId of scopedAccountIds) {
    if (!accessible.has(accountId)) return false;
  }
  return true;
}

async function loadCategoriesByChallenge(
  db: typeof dbInstance,
  challengeIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (challengeIds.length === 0) return map;
  const rows = await db
    .select({
      challengeId: challengeCategory.challengeId,
      categoryId: challengeCategory.categoryId,
    })
    .from(challengeCategory)
    .where(inArray(challengeCategory.challengeId, challengeIds));
  for (const row of rows) {
    const list = map.get(row.challengeId) ?? [];
    list.push(row.categoryId);
    map.set(row.challengeId, list);
  }
  return map;
}

// ── Router ──────────────────────────────────────────────────────────────────

export const challengeRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          includeArchived: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const accessible = await getAccessibleAccountIds(
        ctx.db,
        familyId,
        ctx.session.user.id,
      );

      const rows = await ctx.db
        .select()
        .from(challenge)
        .where(
          input?.includeArchived
            ? eq(challenge.familyId, familyId)
            : and(
                eq(challenge.familyId, familyId),
                isNull(challenge.archivedAt),
              ),
        )
        .orderBy(asc(sql`lower(${challenge.name})`));

      const ids = rows.map((r) => r.id);
      const accountLinks =
        ids.length > 0
          ? await ctx.db
              .select()
              .from(challengeAccount)
              .where(inArray(challengeAccount.challengeId, ids))
          : [];
      const accountsByChallenge = new Map<string, string[]>();
      for (const link of accountLinks) {
        const list = accountsByChallenge.get(link.challengeId) ?? [];
        list.push(link.accountId);
        accountsByChallenge.set(link.challengeId, list);
      }

      const categoriesByChallenge = await loadCategoriesByChallenge(
        ctx.db,
        ids,
      );

      const asOf = todayIso();
      const results = [];
      for (const row of rows) {
        const scoped = accountsByChallenge.get(row.id) ?? [];
        if (!isChallengeVisible(row, scoped, accessible)) continue;

        const current = await rotateChallenge(ctx.db, row);
        const progress = current
          ? await computeProgress(ctx.db, row, current, asOf, {
              viewerId: ctx.session.user.id,
            })
          : 0;
        results.push({
          ...row,
          currentInstance: current,
          progress,
          accountIds: scoped,
          categoryIds: categoriesByChallenge.get(row.id) ?? [],
        });
      }
      return results;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const [row] = await ctx.db
        .select()
        .from(challenge)
        .where(
          and(eq(challenge.id, input.id), eq(challenge.familyId, familyId)),
        );
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const accountLinks = await ctx.db
        .select({ accountId: challengeAccount.accountId })
        .from(challengeAccount)
        .where(eq(challengeAccount.challengeId, row.id));
      const scoped = accountLinks.map((l) => l.accountId);

      const accessible = await getAccessibleAccountIds(
        ctx.db,
        familyId,
        ctx.session.user.id,
      );
      if (!isChallengeVisible(row, scoped, accessible)) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const current = await rotateChallenge(ctx.db, row);
      const instances = await ctx.db
        .select()
        .from(challengeInstance)
        .where(eq(challengeInstance.challengeId, row.id))
        .orderBy(sql`${challengeInstance.periodStart} desc`);

      const categoryLinks = await ctx.db
        .select({ categoryId: challengeCategory.categoryId })
        .from(challengeCategory)
        .where(eq(challengeCategory.challengeId, row.id));

      const asOf = todayIso();
      const progress = current
        ? await computeProgress(ctx.db, row, current, asOf, {
            viewerId: ctx.session.user.id,
          })
        : 0;

      return {
        ...row,
        currentInstance: current,
        instances,
        progress,
        accountIds: scoped,
        categoryIds: categoryLinks.map((l) => l.categoryId),
      };
    }),

  create: protectedProcedure
    .input(createSchema)
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await requireFeature(ctx.db, familyId, "challenges");
      const categoryIds = Array.from(new Set(input.categoryIds ?? []));
      await assertCategoriesInFamily(ctx.db, familyId, categoryIds);
      await assertFamilyResource(ctx.db, familyId, ctx.session.user.id, {
        accountId: input.accountId,
        debtId: input.debtId,
      });
      const scopedAccountIds = Array.from(new Set(input.accountIds ?? []));
      await assertAccountsAccessible(
        ctx.db,
        familyId,
        ctx.session.user.id,
        scopedAccountIds,
      );

      const [created] = await ctx.db
        .insert(challenge)
        .values({
          familyId,
          name: input.name.trim(),
          description: input.description?.trim() ?? null,
          type: input.type,
          repetition: input.repetition,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          customDurationDays: input.customDurationDays ?? null,
          targetAmount: input.targetAmount,
          accountId: input.accountId ?? null,
          debtId: input.debtId ?? null,
        })
        .returning();

      if (created) {
        if (categoryIds.length > 0) {
          await ctx.db.insert(challengeCategory).values(
            categoryIds.map((cid) => ({
              challengeId: created.id,
              categoryId: cid,
            })),
          );
        }
        if (scopedAccountIds.length > 0) {
          await ctx.db.insert(challengeAccount).values(
            scopedAccountIds.map((id) => ({
              challengeId: created.id,
              accountId: id,
            })),
          );
        }
        await rotateChallenge(ctx.db, created);
      }
      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(1000).nullable().optional(),
        targetAmount: z.number().int().positive().optional(),
        categoryIds: z.array(z.string().uuid()).optional(),
        accountId: z.string().uuid().nullable().optional(),
        debtId: z.string().uuid().nullable().optional(),
        accountIds: z.array(z.string().uuid()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      const [existing] = await ctx.db
        .select()
        .from(challenge)
        .where(
          and(eq(challenge.id, input.id), eq(challenge.familyId, familyId)),
        );
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await assertFamilyResource(ctx.db, familyId, ctx.session.user.id, {
        accountId: input.accountId,
        debtId: input.debtId,
      });

      const { id, accountIds, categoryIds, ...data } = input;
      await ctx.db
        .update(challenge)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(challenge.id, id), eq(challenge.familyId, familyId)));

      if (categoryIds !== undefined) {
        const deduped = Array.from(new Set(categoryIds));
        await assertCategoriesInFamily(ctx.db, familyId, deduped);
        await ctx.db
          .delete(challengeCategory)
          .where(eq(challengeCategory.challengeId, id));
        if (deduped.length > 0) {
          await ctx.db.insert(challengeCategory).values(
            deduped.map((cid) => ({
              challengeId: id,
              categoryId: cid,
            })),
          );
        }
      }

      if (accountIds !== undefined) {
        const deduped = Array.from(new Set(accountIds));
        await assertAccountsAccessible(
          ctx.db,
          familyId,
          ctx.session.user.id,
          deduped,
        );
        await ctx.db
          .delete(challengeAccount)
          .where(eq(challengeAccount.challengeId, id));
        if (deduped.length > 0) {
          await ctx.db.insert(challengeAccount).values(
            deduped.map((accountId) => ({
              challengeId: id,
              accountId,
            })),
          );
        }
      }
    }),

  setArchived: protectedProcedure
    .input(z.object({ id: z.string().uuid(), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await ctx.db
        .update(challenge)
        .set({
          archivedAt: input.archived ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(
          and(eq(challenge.id, input.id), eq(challenge.familyId, familyId)),
        );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await ctx.db
        .delete(challenge)
        .where(
          and(eq(challenge.id, input.id), eq(challenge.familyId, familyId)),
        );
    }),
});
