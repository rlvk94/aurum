import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { env } from "~/env";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  getActiveFamilyId,
  getActiveFamilyMembership,
} from "~/server/api/routers/family";
import type { db as dbInstance } from "~/server/db";
import { family, familySubscription } from "~/server/db/schema";
import { getFamilySubscription } from "~/server/billing/entitlements";
import { getStripe, priceIdFor } from "~/server/billing/stripe";

async function requireOwner(
  db: typeof dbInstance,
  userId: string,
): Promise<string> {
  const m = await getActiveFamilyMembership(db, userId);
  if (m.role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Owner role required",
    });
  }
  return m.familyId;
}

function buildAppUrl(path: string): string {
  return `${env.BETTER_AUTH_URL.replace(/\/$/, "")}${path}`;
}

async function ensureStripeCustomer(
  db: typeof dbInstance,
  familyId: string,
  ownerEmail: string,
): Promise<string> {
  const [row] = await db
    .select({ stripeCustomerId: familySubscription.stripeCustomerId })
    .from(familySubscription)
    .where(eq(familySubscription.familyId, familyId));

  if (row?.stripeCustomerId) return row.stripeCustomerId;

  const [familyRow] = await db
    .select({ name: family.name })
    .from(family)
    .where(eq(family.id, familyId));

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: ownerEmail,
    name: familyRow?.name ?? undefined,
    metadata: { familyId },
  });

  await db
    .update(familySubscription)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(familySubscription.familyId, familyId));

  return customer.id;
}

export const billingRouter = createTRPCRouter({
  current: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(
      ctx.db,
      ctx.session.user.id,
    );
    const sub = await getFamilySubscription(ctx.db, familyId);
    return {
      plan: sub.plan,
      status: sub.status,
      cadence: sub.cadence,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      graceEndsAt: sub.graceEndsAt,
      pendingCheckout: sub.pendingCheckout,
    };
  }),

  selectIndividual: protectedProcedure.mutation(async ({ ctx }) => {
    const familyId = await requireOwner(ctx.db, ctx.session.user.id);
    await ctx.db
      .update(familySubscription)
      .set({
        plan: "individual",
        status: "none",
        pendingCheckoutAt: null,
        updatedAt: new Date(),
      })
      .where(eq(familySubscription.familyId, familyId));
  }),

  createCheckoutSession: protectedProcedure
    .input(z.object({ cadence: z.enum(["monthly", "annual"]) }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await requireOwner(ctx.db, ctx.session.user.id);
      const stripe = getStripe();

      const customerId = await ensureStripeCustomer(
        ctx.db,
        familyId,
        ctx.session.user.email,
      );

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: familyId,
        allow_promotion_codes: true,
        line_items: [{ price: priceIdFor(input.cadence), quantity: 1 }],
        subscription_data: {
          metadata: { familyId },
        },
        success_url: buildAppUrl(
          "/welcome?step=plan&checkout=success&session_id={CHECKOUT_SESSION_ID}",
        ),
        cancel_url: buildAppUrl("/welcome?step=plan&checkout=cancel"),
      });

      await ctx.db
        .update(familySubscription)
        .set({ pendingCheckoutAt: new Date(), updatedAt: new Date() })
        .where(eq(familySubscription.familyId, familyId));

      if (!session.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe did not return a checkout URL",
        });
      }
      return { url: session.url };
    }),

  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const familyId = await requireOwner(ctx.db, ctx.session.user.id);
    const sub = await getFamilySubscription(ctx.db, familyId);
    if (!sub.stripeCustomerId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No Stripe customer for this family",
      });
    }
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: buildAppUrl("/settings/billing"),
    });
    return { url: session.url };
  }),
});
