import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { user } from "~/server/db/schema";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 10 * 60 * 1000;

function generateOtp() {
  let code = "";
  for (let i = 0; i < OTP_LENGTH; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

export const userRouter = createTRPCRouter({
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        image: z.string().url().max(2048).nullable().optional(),
        locale: z.enum(["da", "en"]).optional(),
        theme: z.enum(["light", "dark", "system"]).optional(),
        onboardingStep: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({
          ...(input.name && { name: input.name }),
          ...(input.image !== undefined && { image: input.image }),
          ...(input.locale && { locale: input.locale }),
          ...(input.theme && { theme: input.theme }),
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

  me: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        locale: user.locale,
        theme: user.theme,
        pendingEmail: user.pendingEmail,
      })
      .from(user)
      .where(eq(user.id, ctx.session.user.id));
    return row!;
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

  requestEmailChange: protectedProcedure
    .input(z.object({ newEmail: z.string().email().max(255) }))
    .mutation(async ({ ctx, input }) => {
      const newEmail = input.newEmail.trim().toLowerCase();

      const [taken] = await ctx.db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.email, newEmail), ne(user.id, ctx.session.user.id)));
      if (taken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That email is already in use",
        });
      }

      const code = generateOtp();
      await ctx.db
        .update(user)
        .set({
          pendingEmail: newEmail,
          pendingEmailToken: code,
          pendingEmailExpiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
          updatedAt: new Date(),
        })
        .where(eq(user.id, ctx.session.user.id));

      // TODO: send via transactional email provider
      console.log(`[DEV] Email-change OTP for ${newEmail}: ${code}`);
    }),

  confirmEmailChange: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          pendingEmail: user.pendingEmail,
          pendingEmailToken: user.pendingEmailToken,
          pendingEmailExpiresAt: user.pendingEmailExpiresAt,
        })
        .from(user)
        .where(eq(user.id, ctx.session.user.id));

      if (
        !row?.pendingEmail ||
        !row.pendingEmailToken ||
        !row.pendingEmailExpiresAt
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No email change pending",
        });
      }

      if (row.pendingEmailExpiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification code has expired",
        });
      }

      if (row.pendingEmailToken !== input.code) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Incorrect verification code",
        });
      }

      await ctx.db
        .update(user)
        .set({
          email: row.pendingEmail,
          emailVerified: true,
          pendingEmail: null,
          pendingEmailToken: null,
          pendingEmailExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, ctx.session.user.id));
    }),

  cancelEmailChange: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(user)
      .set({
        pendingEmail: null,
        pendingEmailToken: null,
        pendingEmailExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, ctx.session.user.id));
  }),
});
