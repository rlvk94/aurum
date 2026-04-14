import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { user } from "~/server/db/schema";

export const userRouter = createTRPCRouter({
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        locale: z.enum(["da", "en"]).optional(),
        onboardingStep: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({
          ...(input.name && { name: input.name }),
          ...(input.locale && { locale: input.locale }),
          ...(input.onboardingStep !== undefined && {
            onboardingStep: input.onboardingStep,
          }),
          updatedAt: new Date(),
        })
        .where(eq(user.id, ctx.session.user.id));
    }),

  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(user)
      .set({ onboardedAt: new Date(), updatedAt: new Date() })
      .where(eq(user.id, ctx.session.user.id));
  }),

  getOnboardingState: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        onboardingStep: user.onboardingStep,
        onboardedAt: user.onboardedAt,
      })
      .from(user)
      .where(eq(user.id, ctx.session.user.id));
    return row ?? { onboardingStep: 0, onboardedAt: null };
  }),

  setActiveFamily: protectedProcedure
    .input(z.object({ familyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({ activeFamilyId: input.familyId, updatedAt: new Date() })
        .where(eq(user.id, ctx.session.user.id));
    }),

  getActiveFamily: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({ activeFamilyId: user.activeFamilyId })
      .from(user)
      .where(eq(user.id, ctx.session.user.id));
    return row?.activeFamilyId ?? null;
  }),
});
