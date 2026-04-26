import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type Stripe from "stripe";

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

function extractClientSecret(
  invoice: Stripe.Invoice | string | null | undefined,
): string | null {
  if (!invoice || typeof invoice === "string") return null;
  const inv = invoice as unknown as {
    confirmation_secret?: { client_secret?: string | null } | null;
    payment_intent?:
      | { client_secret?: string | null }
      | string
      | null;
  };
  if (inv.confirmation_secret?.client_secret) {
    return inv.confirmation_secret.client_secret;
  }
  if (inv.payment_intent && typeof inv.payment_intent !== "string") {
    return inv.payment_intent.client_secret ?? null;
  }
  return null;
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
      stripeSubscriptionId: sub.stripeSubscriptionId,
    };
  }),

  selectIndividual: protectedProcedure.mutation(async ({ ctx }) => {
    const familyId = await requireOwner(ctx.db, ctx.session.user.id);

    const [row] = await ctx.db
      .select({
        stripeSubscriptionId: familySubscription.stripeSubscriptionId,
        status: familySubscription.status,
      })
      .from(familySubscription)
      .where(eq(familySubscription.familyId, familyId));

    // Cancel any live Stripe subscription so the customer stops being
    // billed. The webhook will reconcile final state, but we also clear
    // local state immediately for a snappy UI.
    if (
      row?.stripeSubscriptionId &&
      row.status !== "canceled" &&
      row.status !== "incomplete_expired"
    ) {
      const stripe = getStripe();
      try {
        await stripe.subscriptions.cancel(row.stripeSubscriptionId);
      } catch (err) {
        console.error(
          "[billing] selectIndividual cancel failed",
          row.stripeSubscriptionId,
          err,
        );
      }
    }

    await ctx.db
      .update(familySubscription)
      .set({
        plan: "individual",
        status: "none",
        cadence: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        graceEndsAt: null,
        pendingCheckoutAt: null,
        updatedAt: new Date(),
      })
      .where(eq(familySubscription.familyId, familyId));
  }),

  /**
   * Create (or refresh) an incomplete subscription so the client can confirm
   * the first payment via Stripe Elements <PaymentElement />.
   *
   * Returns the subscription id and the PaymentIntent client secret. The
   * webhook handlers (`customer.subscription.*`, `invoice.paid`) flip the row
   * to `active` once Stripe confirms the charge.
   */
  createSubscription: protectedProcedure
    .input(z.object({ cadence: z.enum(["monthly", "annual"]) }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await requireOwner(ctx.db, ctx.session.user.id);
      const publishableKey = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Stripe publishable key is not configured",
        });
      }

      const stripe = getStripe();
      const priceId = priceIdFor(input.cadence);

      const customerId = await ensureStripeCustomer(
        ctx.db,
        familyId,
        ctx.session.user.email,
      );

      const [existing] = await ctx.db
        .select({
          stripeSubscriptionId: familySubscription.stripeSubscriptionId,
          status: familySubscription.status,
          stripePriceId: familySubscription.stripePriceId,
        })
        .from(familySubscription)
        .where(eq(familySubscription.familyId, familyId));

      if (existing?.status === "active" || existing?.status === "trialing") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Subscription already active for this family",
        });
      }

      // Reuse an existing incomplete subscription when cadence matches so we
      // don't pile up drafts on the customer; otherwise cancel and recreate.
      if (
        existing?.stripeSubscriptionId &&
        existing.status === "incomplete" &&
        existing.stripePriceId === priceId
      ) {
        try {
          const sub = await stripe.subscriptions.retrieve(
            existing.stripeSubscriptionId,
            {
              expand: [
                "latest_invoice.confirmation_secret",
                "latest_invoice.payment_intent",
              ],
            },
          );
          const clientSecret = extractClientSecret(sub.latest_invoice);
          if (clientSecret) {
            return {
              subscriptionId: sub.id,
              clientSecret,
              publishableKey,
            };
          }
        } catch (err) {
          console.warn(
            "[billing] failed to reuse incomplete subscription",
            existing.stripeSubscriptionId,
            err,
          );
        }
      }

      if (existing?.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(existing.stripeSubscriptionId);
        } catch {
          // Already canceled / not found — ignore and create a fresh one.
        }
      }

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
          payment_method_types: ["card"],
        },
        expand: [
          "latest_invoice.confirmation_secret",
          "latest_invoice.payment_intent",
        ],
        metadata: { familyId },
      });

      const clientSecret = extractClientSecret(subscription.latest_invoice);
      if (!clientSecret) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe did not return a client secret",
        });
      }

      await ctx.db
        .update(familySubscription)
        .set({
          pendingCheckoutAt: new Date(),
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          cadence: input.cadence,
          status: "incomplete",
          updatedAt: new Date(),
        })
        .where(eq(familySubscription.familyId, familyId));

      return {
        subscriptionId: subscription.id,
        clientSecret,
        publishableKey,
      };
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

  /**
   * Swap the active subscription to a different cadence (monthly ↔ annual).
   * Stripe prorates the unused portion of the old period against the new one.
   */
  changeCadence: protectedProcedure
    .input(z.object({ cadence: z.enum(["monthly", "annual"]) }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await requireOwner(ctx.db, ctx.session.user.id);
      const stripe = getStripe();
      const newPriceId = priceIdFor(input.cadence);

      const [row] = await ctx.db
        .select({
          stripeSubscriptionId: familySubscription.stripeSubscriptionId,
          stripePriceId: familySubscription.stripePriceId,
          status: familySubscription.status,
        })
        .from(familySubscription)
        .where(eq(familySubscription.familyId, familyId));

      if (!row?.stripeSubscriptionId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active subscription for this family",
        });
      }
      if (row.status !== "active" && row.status !== "trialing") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Subscription must be active to change cadence",
        });
      }
      if (row.stripePriceId === newPriceId) {
        return; // already on the requested cadence
      }

      const subscription = await stripe.subscriptions.retrieve(
        row.stripeSubscriptionId,
      );
      const itemId = subscription.items.data[0]?.id;
      if (!itemId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Subscription has no items",
        });
      }

      await stripe.subscriptions.update(row.stripeSubscriptionId, {
        items: [{ id: itemId, price: newPriceId }],
        proration_behavior: "create_prorations",
      });
      // Webhook (`customer.subscription.updated`) reconciles cadence + price.
    }),

  /**
   * Schedule cancellation at period end. The user keeps Family access until
   * `currentPeriodEnd`, then Stripe fires `customer.subscription.deleted` and
   * the webhook flips them to Individual.
   */
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const familyId = await requireOwner(ctx.db, ctx.session.user.id);

    const [row] = await ctx.db
      .select({
        stripeSubscriptionId: familySubscription.stripeSubscriptionId,
        status: familySubscription.status,
      })
      .from(familySubscription)
      .where(eq(familySubscription.familyId, familyId));

    if (!row?.stripeSubscriptionId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No active subscription for this family",
      });
    }

    const stripe = getStripe();
    const updated = await stripe.subscriptions.update(row.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Reflect immediately so the UI doesn't lag behind the webhook.
    await ctx.db
      .update(familySubscription)
      .set({
        cancelAtPeriodEnd: true,
        currentPeriodEnd: updated.items.data[0]?.current_period_end
          ? new Date(updated.items.data[0].current_period_end * 1000)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(familySubscription.familyId, familyId));
  }),

  /**
   * Undo a scheduled cancellation while still inside the current period.
   * Stripe re-enables auto-renewal; the webhook reconciles the row.
   */
  resumeSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const familyId = await requireOwner(ctx.db, ctx.session.user.id);

    const [row] = await ctx.db
      .select({
        stripeSubscriptionId: familySubscription.stripeSubscriptionId,
        cancelAtPeriodEnd: familySubscription.cancelAtPeriodEnd,
      })
      .from(familySubscription)
      .where(eq(familySubscription.familyId, familyId));

    if (!row?.stripeSubscriptionId || !row.cancelAtPeriodEnd) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No scheduled cancellation to resume",
      });
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(row.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await ctx.db
      .update(familySubscription)
      .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
      .where(eq(familySubscription.familyId, familyId));
  }),
});
