import { z } from "zod";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { requireFeature } from "~/server/billing/entitlements";
import type { db as dbInstance } from "~/server/db";
import { asset, debt, user } from "~/server/db/schema";
import {
  buildSchedule,
  summarize,
  type LoanParams,
} from "~/server/lib/amortization";

const paymentFrequencySchema = z.enum([
  "monthly",
  "bi_monthly",
  "quarterly",
  "semi_annual",
  "annual",
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loanParams(row: {
  principal: number;
  interestRateBps: number;
  termMonths: number;
  paymentFrequency: LoanParams["paymentFrequency"];
}): LoanParams {
  return {
    principal: row.principal,
    interestRateBps: row.interestRateBps,
    termMonths: row.termMonths,
    paymentFrequency: row.paymentFrequency,
  };
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  lender: z.string().min(1).max(100),
  principal: z.number().int().positive(),
  interestRateBps: z.number().int().min(0).max(100_000),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  termMonths: z.number().int().min(1).max(720),
  paymentFrequency: paymentFrequencySchema,
  assetId: z.string().uuid().nullable().optional(),
  note: z.string().max(1000).optional(),
});

async function assertAssetInFamily(
  db: typeof dbInstance,
  familyId: string,
  assetId: string,
) {
  const [row] = await db
    .select({ id: asset.id })
    .from(asset)
    .where(and(eq(asset.id, assetId), eq(asset.familyId, familyId)));
  if (!row) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Asset not found in this family",
    });
  }
}

export const debtRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    const rows = await ctx.db
      .select({
        id: debt.id,
        familyId: debt.familyId,
        name: debt.name,
        lender: debt.lender,
        principal: debt.principal,
        interestRateBps: debt.interestRateBps,
        startDate: debt.startDate,
        termMonths: debt.termMonths,
        paymentFrequency: debt.paymentFrequency,
        assetId: debt.assetId,
        assetName: asset.name,
        note: debt.note,
        archivedAt: debt.archivedAt,
        createdAt: debt.createdAt,
        updatedAt: debt.updatedAt,
      })
      .from(debt)
      .leftJoin(asset, eq(debt.assetId, asset.id))
      .where(eq(debt.familyId, familyId))
      .orderBy(asc(sql`lower(${debt.name})`));

    const asOf = today();
    return rows.map((row) => ({
      ...row,
      summary: summarize(loanParams(row), row.startDate, asOf),
    }));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const [row] = await ctx.db
        .select({
          id: debt.id,
          familyId: debt.familyId,
          name: debt.name,
          lender: debt.lender,
          principal: debt.principal,
          interestRateBps: debt.interestRateBps,
          startDate: debt.startDate,
          termMonths: debt.termMonths,
          paymentFrequency: debt.paymentFrequency,
          assetId: debt.assetId,
          assetName: asset.name,
          note: debt.note,
          archivedAt: debt.archivedAt,
          createdAt: debt.createdAt,
          updatedAt: debt.updatedAt,
        })
        .from(debt)
        .leftJoin(asset, eq(debt.assetId, asset.id))
        .where(and(eq(debt.id, input.id), eq(debt.familyId, familyId)));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const asOf = today();
      return {
        ...row,
        summary: summarize(loanParams(row), row.startDate, asOf),
        schedule: buildSchedule(loanParams(row), row.startDate),
      };
    }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    const rows = await ctx.db
      .select({
        principal: debt.principal,
        interestRateBps: debt.interestRateBps,
        startDate: debt.startDate,
        termMonths: debt.termMonths,
        paymentFrequency: debt.paymentFrequency,
      })
      .from(debt)
      .where(and(eq(debt.familyId, familyId), isNull(debt.archivedAt)));

    const asOf = today();
    let totalOutstanding = 0;
    let totalMonthlyEquivalent = 0;
    for (const row of rows) {
      const s = summarize(loanParams(row), row.startDate, asOf);
      totalOutstanding += s.outstandingBalance;
      totalMonthlyEquivalent += s.monthlyEquivalent;
    }
    return {
      count: rows.length,
      totalOutstanding,
      totalMonthlyEquivalent,
    };
  }),

  create: protectedProcedure
    .input(createSchema)
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await requireFeature(ctx.db, familyId, "debts");

      if (input.assetId) {
        await assertAssetInFamily(ctx.db, familyId, input.assetId);
      }

      const [created] = await ctx.db
        .insert(debt)
        .values({
          familyId,
          name: input.name.trim(),
          lender: input.lender.trim(),
          principal: input.principal,
          interestRateBps: input.interestRateBps,
          startDate: input.startDate,
          termMonths: input.termMonths,
          paymentFrequency: input.paymentFrequency,
          assetId: input.assetId ?? null,
          note: input.note?.trim() ? input.note.trim() : null,
        })
        .returning();

      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        lender: z.string().min(1).max(100).optional(),
        principal: z.number().int().positive().optional(),
        interestRateBps: z.number().int().min(0).max(100_000).optional(),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        termMonths: z.number().int().min(1).max(720).optional(),
        paymentFrequency: paymentFrequencySchema.optional(),
        assetId: z.string().uuid().nullable().optional(),
        note: z.string().max(1000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      if (input.assetId) {
        await assertAssetInFamily(ctx.db, familyId, input.assetId);
      }
      const { id, ...data } = input;
      await ctx.db
        .update(debt)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(debt.id, id), eq(debt.familyId, familyId)));
    }),

  setArchived: protectedProcedure
    .input(z.object({ id: z.string().uuid(), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await ctx.db
        .update(debt)
        .set({
          archivedAt: input.archived ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(and(eq(debt.id, input.id), eq(debt.familyId, familyId)));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await ctx.db
        .delete(debt)
        .where(and(eq(debt.id, input.id), eq(debt.familyId, familyId)));
    }),
});
