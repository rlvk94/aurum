import { z } from "zod";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { requireFeature } from "~/server/billing/entitlements";
import type { db as dbInstance } from "~/server/db";
import { asset, debt, user } from "~/server/db/schema";
import { summarize } from "~/server/lib/amortization";

const assetTypeSchema = z.enum([
  "property",
  "vehicle",
  "investment",
  "collectible",
  "other",
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

export const assetRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    const [assets, debts] = await Promise.all([
      ctx.db
        .select()
        .from(asset)
        .where(eq(asset.familyId, familyId))
        .orderBy(asc(sql`lower(${asset.name})`)),
      ctx.db
        .select({
          id: debt.id,
          name: debt.name,
          assetId: debt.assetId,
          principal: debt.principal,
          interestRateBps: debt.interestRateBps,
          startDate: debt.startDate,
          termMonths: debt.termMonths,
          paymentFrequency: debt.paymentFrequency,
        })
        .from(debt)
        .where(
          and(
            eq(debt.familyId, familyId),
            isNotNull(debt.assetId),
            isNull(debt.archivedAt),
          ),
        ),
    ]);

    const asOf = new Date().toISOString().slice(0, 10);
    const byAsset = new Map<
      string,
      Array<{
        id: string;
        name: string;
        outstandingBalance: number;
        principal: number;
      }>
    >();
    for (const d of debts) {
      if (!d.assetId) continue;
      const s = summarize(
        {
          principal: d.principal,
          interestRateBps: d.interestRateBps,
          termMonths: d.termMonths,
          paymentFrequency: d.paymentFrequency,
        },
        d.startDate,
        asOf,
      );
      const list = byAsset.get(d.assetId) ?? [];
      list.push({
        id: d.id,
        name: d.name,
        outstandingBalance: s.outstandingBalance,
        principal: d.principal,
      });
      byAsset.set(d.assetId, list);
    }

    return assets.map((a) => {
      const linked = byAsset.get(a.id) ?? [];
      const debtOutstanding = linked.reduce(
        (s, d) => s + d.outstandingBalance,
        0,
      );
      return {
        ...a,
        linkedDebts: linked,
        debtOutstanding,
        equity: a.value - debtOutstanding,
      };
    });
  }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

    const [result] = await ctx.db
      .select({
        total: sql<number>`coalesce(sum(${asset.value}), 0)`,
      })
      .from(asset)
      .where(and(eq(asset.familyId, familyId), eq(asset.archived, false)));

    return { total: Number(result?.total ?? 0) };
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        type: assetTypeSchema,
        value: z.number().int().default(0),
        note: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await requireFeature(ctx.db, familyId, "assets");

      const [created] = await ctx.db
        .insert(asset)
        .values({
          familyId,
          name: input.name,
          type: input.type,
          value: input.value,
          note: input.note ?? null,
        })
        .returning();

      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        type: assetTypeSchema.optional(),
        value: z.number().int().optional(),
        note: z.string().max(1000).nullable().optional(),
        archived: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const { id, ...data } = input;

      await ctx.db
        .update(asset)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(asset.id, id), eq(asset.familyId, familyId)));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);

      await ctx.db
        .delete(asset)
        .where(and(eq(asset.id, input.id), eq(asset.familyId, familyId)));
    }),
});
