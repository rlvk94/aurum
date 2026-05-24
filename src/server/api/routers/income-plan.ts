import { z } from "zod";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { PROJECT_PALETTES } from "~/server/api/routers/project";
import type { db as dbInstance } from "~/server/db";
import {
  incomePlan,
  incomePlanIncome,
  incomePlanLine,
  user,
} from "~/server/db/schema";

// ── Validation ──────────────────────────────────────────────────────────────

const allocationTypeSchema = z.enum(["percentage", "fixed"]);
const targetColorSchema = z.enum(PROJECT_PALETTES);

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

type DbOrTx = Parameters<
  Parameters<typeof dbInstance.transaction>[0]
>[0] | typeof dbInstance;

async function assertPlanBelongsToFamily(
  db: DbOrTx,
  planId: string,
  familyId: string,
) {
  const [row] = await db
    .select({ id: incomePlan.id })
    .from(incomePlan)
    .where(and(eq(incomePlan.id, planId), eq(incomePlan.familyId, familyId)));
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
  }
}

function validateLineValue(
  allocationType: "percentage" | "fixed",
  value: number,
) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Value must be a non-negative integer",
    });
  }
  if (allocationType === "percentage" && value > 10_000) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Percentage may not exceed 100%",
    });
  }
}

// ── Router ──────────────────────────────────────────────────────────────────

export const incomePlanRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

    const plans = await ctx.db
      .select()
      .from(incomePlan)
      .where(eq(incomePlan.familyId, familyId))
      .orderBy(
        desc(incomePlan.isActive),
        asc(incomePlan.archived),
        desc(incomePlan.createdAt),
      );

    if (plans.length === 0) return [];

    const planIds = plans.map((p) => p.id);

    const [incomes, lines] = await Promise.all([
      ctx.db
        .select({
          planId: incomePlanIncome.planId,
          total: sql<number>`coalesce(sum(${incomePlanIncome.amount}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(incomePlanIncome)
        .where(inArray(incomePlanIncome.planId, planIds))
        .groupBy(incomePlanIncome.planId),
      ctx.db
        .select({
          planId: incomePlanLine.planId,
          allocationType: incomePlanLine.allocationType,
          value: incomePlanLine.value,
        })
        .from(incomePlanLine)
        .where(inArray(incomePlanLine.planId, planIds)),
    ]);

    const totalsByPlan = new Map(
      incomes.map((i) => [i.planId, { total: Number(i.total), count: Number(i.count) }]),
    );

    const linesByPlan = new Map<
      string,
      { percentageBps: number; fixedCents: number; lineCount: number }
    >();
    for (const l of lines) {
      const cur = linesByPlan.get(l.planId) ?? {
        percentageBps: 0,
        fixedCents: 0,
        lineCount: 0,
      };
      if (l.allocationType === "percentage") cur.percentageBps += l.value;
      else cur.fixedCents += l.value;
      cur.lineCount += 1;
      linesByPlan.set(l.planId, cur);
    }

    return plans.map((p) => {
      const totals = totalsByPlan.get(p.id) ?? { total: 0, count: 0 };
      const lineAgg = linesByPlan.get(p.id) ?? {
        percentageBps: 0,
        fixedCents: 0,
        lineCount: 0,
      };
      return {
        ...p,
        totalIncome: totals.total,
        incomeCount: totals.count,
        allocationLineCount: lineAgg.lineCount,
        allocatedPercentageBps: lineAgg.percentageBps,
        allocatedFixedCents: lineAgg.fixedCents,
      };
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      const [plan] = await ctx.db
        .select()
        .from(incomePlan)
        .where(
          and(eq(incomePlan.id, input.id), eq(incomePlan.familyId, familyId)),
        );

      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      }

      const [incomes, lines] = await Promise.all([
        ctx.db
          .select()
          .from(incomePlanIncome)
          .where(eq(incomePlanIncome.planId, plan.id))
          .orderBy(asc(incomePlanIncome.sortOrder), asc(incomePlanIncome.createdAt)),
        ctx.db
          .select()
          .from(incomePlanLine)
          .where(eq(incomePlanLine.planId, plan.id))
          .orderBy(asc(incomePlanLine.sortOrder), asc(incomePlanLine.createdAt)),
      ]);

      return { ...plan, incomes, lines };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      return await ctx.db.transaction(async (tx) => {
        const [countRow] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(incomePlan)
          .where(eq(incomePlan.familyId, familyId));

        const shouldActivate = Number(countRow?.count ?? 0) === 0;

        const [created] = await tx
          .insert(incomePlan)
          .values({
            familyId,
            name: input.name,
            description: input.description ?? null,
            isActive: shouldActivate,
          })
          .returning();

        return created;
      });
    }),

  // Clone a plan along with its incomes and allocation lines. The new plan is
  // inactive by default (only one plan per family may be active at a time) and
  // gets a " (kopi)" suffix so it's easy to spot in the list.
  duplicate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      return await ctx.db.transaction(async (tx) => {
        const [source] = await tx
          .select()
          .from(incomePlan)
          .where(
            and(
              eq(incomePlan.id, input.id),
              eq(incomePlan.familyId, familyId),
            ),
          );
        if (!source) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
        }

        const [created] = await tx
          .insert(incomePlan)
          .values({
            familyId,
            name: `${source.name} (kopi)`,
            description: source.description,
            isActive: false,
            archived: false,
          })
          .returning();
        if (!created) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create plan copy",
          });
        }

        const sourceIncomes = await tx
          .select()
          .from(incomePlanIncome)
          .where(eq(incomePlanIncome.planId, source.id));
        if (sourceIncomes.length > 0) {
          await tx.insert(incomePlanIncome).values(
            sourceIncomes.map((i) => ({
              planId: created.id,
              name: i.name,
              amount: i.amount,
              sortOrder: i.sortOrder,
            })),
          );
        }

        const sourceLines = await tx
          .select()
          .from(incomePlanLine)
          .where(eq(incomePlanLine.planId, source.id));
        if (sourceLines.length > 0) {
          await tx.insert(incomePlanLine).values(
            sourceLines.map((l) => ({
              planId: created.id,
              target: l.target,
              targetColor: l.targetColor,
              allocationType: l.allocationType,
              value: l.value,
              note: l.note,
              sortOrder: l.sortOrder,
            })),
          );
        }

        return created;
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(1000).nullable().optional(),
        archived: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const { id, ...data } = input;

      await ctx.db.transaction(async (tx) => {
        await assertPlanBelongsToFamily(tx, id, familyId);
        const patch: Partial<typeof incomePlan.$inferInsert> = {
          ...data,
          updatedAt: new Date(),
        };
        // Archiving an active plan clears its active flag.
        if (data.archived === true) patch.isActive = false;
        await tx.update(incomePlan).set(patch).where(eq(incomePlan.id, id));
      });
    }),

  setActive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      await ctx.db.transaction(async (tx) => {
        await assertPlanBelongsToFamily(tx, input.id, familyId);

        await tx
          .update(incomePlan)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(incomePlan.familyId, familyId),
              ne(incomePlan.id, input.id),
            ),
          );

        await tx
          .update(incomePlan)
          .set({ isActive: true, archived: false, updatedAt: new Date() })
          .where(eq(incomePlan.id, input.id));
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await ctx.db
        .delete(incomePlan)
        .where(
          and(eq(incomePlan.id, input.id), eq(incomePlan.familyId, familyId)),
        );
    }),

  addIncome: protectedProcedure
    .input(
      z.object({
        planId: z.string().uuid(),
        name: z.string().min(1).max(100),
        amount: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await assertPlanBelongsToFamily(ctx.db, input.planId, familyId);

      const [orderRow] = await ctx.db
        .select({
          maxOrder: sql<number>`coalesce(max(${incomePlanIncome.sortOrder}), -1)`,
        })
        .from(incomePlanIncome)
        .where(eq(incomePlanIncome.planId, input.planId));

      const [created] = await ctx.db
        .insert(incomePlanIncome)
        .values({
          planId: input.planId,
          name: input.name,
          amount: input.amount,
          sortOrder: Number(orderRow?.maxOrder ?? -1) + 1,
        })
        .returning();

      return created;
    }),

  updateIncome: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        amount: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const { id, ...data } = input;

      // Authorise: the income's plan must belong to the active family.
      const [row] = await ctx.db
        .select({ planId: incomePlanIncome.planId })
        .from(incomePlanIncome)
        .innerJoin(incomePlan, eq(incomePlan.id, incomePlanIncome.planId))
        .where(
          and(
            eq(incomePlanIncome.id, id),
            eq(incomePlan.familyId, familyId),
          ),
        );
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Income not found" });
      }

      await ctx.db
        .update(incomePlanIncome)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(incomePlanIncome.id, id));
    }),

  deleteIncome: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      const [row] = await ctx.db
        .select({ id: incomePlanIncome.id })
        .from(incomePlanIncome)
        .innerJoin(incomePlan, eq(incomePlan.id, incomePlanIncome.planId))
        .where(
          and(
            eq(incomePlanIncome.id, input.id),
            eq(incomePlan.familyId, familyId),
          ),
        );
      if (!row) return;

      await ctx.db
        .delete(incomePlanIncome)
        .where(eq(incomePlanIncome.id, input.id));
    }),

  addLine: protectedProcedure
    .input(
      z.object({
        planId: z.string().uuid(),
        target: z.string().min(1).max(80),
        targetColor: targetColorSchema,
        allocationType: allocationTypeSchema,
        value: z.number().int().min(0),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await assertPlanBelongsToFamily(ctx.db, input.planId, familyId);
      validateLineValue(input.allocationType, input.value);

      const [orderRow] = await ctx.db
        .select({
          maxOrder: sql<number>`coalesce(max(${incomePlanLine.sortOrder}), -1)`,
        })
        .from(incomePlanLine)
        .where(eq(incomePlanLine.planId, input.planId));

      const [created] = await ctx.db
        .insert(incomePlanLine)
        .values({
          planId: input.planId,
          target: input.target.trim(),
          targetColor: input.targetColor,
          allocationType: input.allocationType,
          value: input.value,
          note: input.note ?? null,
          sortOrder: Number(orderRow?.maxOrder ?? -1) + 1,
        })
        .returning();

      return created;
    }),

  updateLine: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        target: z.string().min(1).max(80).optional(),
        targetColor: targetColorSchema.optional(),
        allocationType: allocationTypeSchema.optional(),
        value: z.number().int().min(0).optional(),
        note: z.string().max(500).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const { id, ...data } = input;

      const [row] = await ctx.db
        .select({
          id: incomePlanLine.id,
          allocationType: incomePlanLine.allocationType,
        })
        .from(incomePlanLine)
        .innerJoin(incomePlan, eq(incomePlan.id, incomePlanLine.planId))
        .where(
          and(
            eq(incomePlanLine.id, id),
            eq(incomePlan.familyId, familyId),
          ),
        );
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Allocation line not found",
        });
      }

      if (data.value !== undefined) {
        const effectiveType = data.allocationType ?? row.allocationType;
        validateLineValue(effectiveType, data.value);
      }

      const patch: Partial<typeof incomePlanLine.$inferInsert> = {
        ...data,
        updatedAt: new Date(),
      };
      if (data.target !== undefined) patch.target = data.target.trim();

      await ctx.db
        .update(incomePlanLine)
        .set(patch)
        .where(eq(incomePlanLine.id, id));
    }),

  deleteLine: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      const [row] = await ctx.db
        .select({ id: incomePlanLine.id })
        .from(incomePlanLine)
        .innerJoin(incomePlan, eq(incomePlan.id, incomePlanLine.planId))
        .where(
          and(
            eq(incomePlanLine.id, input.id),
            eq(incomePlan.familyId, familyId),
          ),
        );
      if (!row) return;

      await ctx.db
        .delete(incomePlanLine)
        .where(eq(incomePlanLine.id, input.id));
    }),

  reorderLines: protectedProcedure
    .input(
      z.object({
        planId: z.string().uuid(),
        lineIds: z.array(z.string().uuid()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await assertPlanBelongsToFamily(ctx.db, input.planId, familyId);

      await ctx.db.transaction(async (tx) => {
        for (let i = 0; i < input.lineIds.length; i++) {
          await tx
            .update(incomePlanLine)
            .set({ sortOrder: i, updatedAt: new Date() })
            .where(
              and(
                eq(incomePlanLine.id, input.lineIds[i]!),
                eq(incomePlanLine.planId, input.planId),
              ),
            );
        }
      });
    }),
});
