import { z } from "zod";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { requireFeature } from "~/server/billing/entitlements";
import type { db as dbInstance } from "~/server/db";
import {
  financialAccount,
  financialAccountAccess,
  project,
  transaction,
  user,
} from "~/server/db/schema";

// Eight curated palettes. The UI maps each key to a gradient via CSS
// variables; the server only validates that the key is in the set.
export const PROJECT_PALETTES = [
  "gold",
  "sand",
  "sage",
  "ocean",
  "sky",
  "plum",
  "clay",
  "slate",
] as const;
export type ProjectPalette = (typeof PROJECT_PALETTES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const palette = z.enum(PROJECT_PALETTES);
// Permissive emoji guard: 1–8 characters covers single-glyph emojis with
// possible variation selectors and ZWJ sequences.
const emoji = z.string().min(1).max(8);

const baseShape = {
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable().optional(),
  emoji: emoji.optional(),
  coverPalette: palette.optional(),
  spendingLimit: z.number().int().positive().nullable().optional(),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
} as const;

function checkDateOrder(
  start: string | null | undefined,
  end: string | null | undefined,
  ctx: z.RefinementCtx,
) {
  if (start && end && end < start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date must be on or after start date",
      path: ["endDate"],
    });
  }
}

const createSchema = z
  .object(baseShape)
  .superRefine((data, ctx) =>
    checkDateOrder(data.startDate, data.endDate, ctx),
  );

const updateSchema = z
  .object({
    id: z.string().uuid(),
    ...baseShape,
  })
  .partial({
    name: true,
    description: true,
    emoji: true,
    coverPalette: true,
    spendingLimit: true,
    startDate: true,
    endDate: true,
  })
  .superRefine((data, ctx) =>
    checkDateOrder(data.startDate, data.endDate, ctx),
  );

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
  return rows.map((r) => r.id);
}

async function loadProjectInFamily(
  db: typeof dbInstance,
  projectId: string,
  familyId: string,
) {
  const [row] = await db
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.familyId, familyId)));
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  return row;
}

type Aggregate = {
  spent: number;
  received: number;
  net: number;
  transactionCount: number;
  topCategoryIds: string[];
};

async function aggregateProjects(
  db: typeof dbInstance,
  projectIds: string[],
  accessibleAccountIds: string[],
): Promise<Map<string, Aggregate>> {
  const map = new Map<string, Aggregate>();
  if (projectIds.length === 0 || accessibleAccountIds.length === 0) return map;

  const totalsRows = await db
    .select({
      projectId: transaction.projectId,
      type: transaction.type,
      total: sql<number>`coalesce(sum(${transaction.amount}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(transaction)
    .where(
      and(
        inArray(transaction.projectId, projectIds),
        inArray(transaction.accountId, accessibleAccountIds),
        eq(transaction.excludedFromCalculations, false),
      ),
    )
    .groupBy(transaction.projectId, transaction.type);

  for (const row of totalsRows) {
    if (!row.projectId) continue;
    const cur = map.get(row.projectId) ?? {
      spent: 0,
      received: 0,
      net: 0,
      transactionCount: 0,
      topCategoryIds: [],
    };
    if (row.type === "expense") cur.spent += Number(row.total);
    if (row.type === "income") cur.received += Number(row.total);
    cur.transactionCount += Number(row.count);
    cur.net = cur.spent - cur.received;
    map.set(row.projectId, cur);
  }

  // Top categories per project (expense-only). One pass, then bucket in JS.
  const catRows = await db
    .select({
      projectId: transaction.projectId,
      categoryId: transaction.categoryId,
      total: sql<number>`coalesce(sum(${transaction.amount}), 0)`,
    })
    .from(transaction)
    .where(
      and(
        inArray(transaction.projectId, projectIds),
        inArray(transaction.accountId, accessibleAccountIds),
        eq(transaction.type, "expense"),
        eq(transaction.excludedFromCalculations, false),
      ),
    )
    .groupBy(transaction.projectId, transaction.categoryId);

  const byProject = new Map<string, { id: string | null; total: number }[]>();
  for (const row of catRows) {
    if (!row.projectId) continue;
    const list = byProject.get(row.projectId) ?? [];
    list.push({ id: row.categoryId ?? null, total: Number(row.total) });
    byProject.set(row.projectId, list);
  }
  for (const [pid, list] of byProject) {
    list.sort((a, b) => b.total - a.total);
    const topIds = list
      .filter((x) => x.id !== null)
      .slice(0, 5)
      .map((x) => x.id!);
    const cur = map.get(pid);
    if (cur) cur.topCategoryIds = topIds;
  }

  return map;
}

export const projectRouter = createTRPCRouter({
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
        .from(project)
        .where(
          input?.includeArchived
            ? eq(project.familyId, familyId)
            : and(eq(project.familyId, familyId), isNull(project.archivedAt)),
        )
        .orderBy(asc(sql`lower(${project.name})`));

      const aggMap = await aggregateProjects(
        ctx.db,
        rows.map((r) => r.id),
        accessible,
      );

      return rows.map((row) => {
        const agg = aggMap.get(row.id) ?? {
          spent: 0,
          received: 0,
          net: 0,
          transactionCount: 0,
          topCategoryIds: [],
        };
        return { ...row, ...agg };
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const row = await loadProjectInFamily(ctx.db, input.id, familyId);

      const accessible = await getAccessibleAccountIds(
        ctx.db,
        familyId,
        ctx.session.user.id,
      );

      // Full breakdowns for the detail page.
      const byCategoryRows =
        accessible.length === 0
          ? []
          : await ctx.db
              .select({
                categoryId: transaction.categoryId,
                spent: sql<number>`coalesce(sum(case when ${transaction.type} = 'expense' then ${transaction.amount} else 0 end), 0)`,
                received: sql<number>`coalesce(sum(case when ${transaction.type} = 'income' then ${transaction.amount} else 0 end), 0)`,
                count: sql<number>`count(*)::int`,
              })
              .from(transaction)
              .where(
                and(
                  eq(transaction.projectId, row.id),
                  inArray(transaction.accountId, accessible),
                  eq(transaction.excludedFromCalculations, false),
                ),
              )
              .groupBy(transaction.categoryId);

      const byAccountRows =
        accessible.length === 0
          ? []
          : await ctx.db
              .select({
                accountId: transaction.accountId,
                spent: sql<number>`coalesce(sum(case when ${transaction.type} = 'expense' then ${transaction.amount} else 0 end), 0)`,
                received: sql<number>`coalesce(sum(case when ${transaction.type} = 'income' then ${transaction.amount} else 0 end), 0)`,
                count: sql<number>`count(*)::int`,
              })
              .from(transaction)
              .where(
                and(
                  eq(transaction.projectId, row.id),
                  inArray(transaction.accountId, accessible),
                  eq(transaction.excludedFromCalculations, false),
                ),
              )
              .groupBy(transaction.accountId);

      const recentTransactions =
        accessible.length === 0
          ? []
          : await ctx.db
              .select()
              .from(transaction)
              .where(
                and(
                  eq(transaction.projectId, row.id),
                  inArray(transaction.accountId, accessible),
                  eq(transaction.excludedFromCalculations, false),
                ),
              )
              .orderBy(
                desc(transaction.date),
                desc(transaction.createdAt),
                desc(transaction.id),
              )
              .limit(30);

      const totals = byCategoryRows.reduce(
        (acc, r) => ({
          spent: acc.spent + Number(r.spent),
          received: acc.received + Number(r.received),
          count: acc.count + Number(r.count),
        }),
        { spent: 0, received: 0, count: 0 },
      );

      return {
        ...row,
        spent: totals.spent,
        received: totals.received,
        net: totals.spent - totals.received,
        transactionCount: totals.count,
        byCategory: byCategoryRows.map((r) => ({
          categoryId: r.categoryId ?? null,
          spent: Number(r.spent),
          received: Number(r.received),
          count: Number(r.count),
        })),
        byAccount: byAccountRows.map((r) => ({
          accountId: r.accountId,
          spent: Number(r.spent),
          received: Number(r.received),
          count: Number(r.count),
        })),
        recentTransactions,
      };
    }),

  create: protectedProcedure
    .input(createSchema)
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await requireFeature(ctx.db, familyId, "projects");
      const [created] = await ctx.db
        .insert(project)
        .values({
          familyId,
          name: input.name.trim(),
          description: input.description?.trim() ?? null,
          emoji: input.emoji ?? "📌",
          coverPalette: input.coverPalette ?? "gold",
          spendingLimit: input.spendingLimit ?? null,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
        })
        .returning();
      return created;
    }),

  update: protectedProcedure
    .input(updateSchema)
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await loadProjectInFamily(ctx.db, input.id, familyId);

      const { id, ...rest } = input;
      const updates: Partial<typeof project.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (rest.name !== undefined) updates.name = rest.name.trim();
      if (rest.description !== undefined)
        updates.description = rest.description?.trim() ?? null;
      if (rest.emoji !== undefined) updates.emoji = rest.emoji;
      if (rest.coverPalette !== undefined)
        updates.coverPalette = rest.coverPalette;
      if (rest.spendingLimit !== undefined)
        updates.spendingLimit = rest.spendingLimit;
      if (rest.startDate !== undefined) updates.startDate = rest.startDate;
      if (rest.endDate !== undefined) updates.endDate = rest.endDate;

      await ctx.db
        .update(project)
        .set(updates)
        .where(and(eq(project.id, id), eq(project.familyId, familyId)));
    }),

  setArchived: protectedProcedure
    .input(z.object({ id: z.string().uuid(), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await loadProjectInFamily(ctx.db, input.id, familyId);
      await ctx.db
        .update(project)
        .set({
          archivedAt: input.archived ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(and(eq(project.id, input.id), eq(project.familyId, familyId)));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await ctx.db
        .delete(project)
        .where(and(eq(project.id, input.id), eq(project.familyId, familyId)));
    }),

  assignTransactions: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid().nullable(),
        transactionIds: z.array(z.string().uuid()).min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      // Allow unassign (projectId=null) so downgraded families can clean up
      // legacy associations; gate only the assign-to-project path.
      if (input.projectId) {
        await requireFeature(ctx.db, familyId, "projects");
        await loadProjectInFamily(ctx.db, input.projectId, familyId);
      }

      const accessible = await getAccessibleAccountIds(
        ctx.db,
        familyId,
        ctx.session.user.id,
      );
      if (accessible.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const matching = await ctx.db
        .select({ id: transaction.id })
        .from(transaction)
        .where(
          and(
            inArray(transaction.id, input.transactionIds),
            eq(transaction.familyId, familyId),
            inArray(transaction.accountId, accessible),
          ),
        );
      const allowedIds = matching.map((r) => r.id);
      if (allowedIds.length === 0) return { updated: 0 };

      await ctx.db
        .update(transaction)
        .set({ projectId: input.projectId, updatedAt: new Date() })
        .where(inArray(transaction.id, allowedIds));

      return { updated: allowedIds.length };
    }),
});
