import "server-only";

import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import type { db as dbInstance } from "~/server/db";
import { familySubscription } from "~/server/db/schema";
import {
  sendBillingDowngradedEmail,
  sendBillingGraceStartedEmail,
  sendBillingRecoveredEmail,
} from "~/server/email";

import {
  computeGraceEndsAt,
  graceJustEnded,
  graceJustStarted,
  projectSubscription,
} from "./projection";

/**
 * Apply a Stripe Subscription update to the matching `family_subscription`
 * row, advance the grace state machine, and dispatch lifecycle emails.
 *
 * Idempotent: webhook redeliveries with the same event will produce the same
 * end state and will not re-send emails (grace timestamp is the gate).
 */
export async function applySubscriptionUpdate(args: {
  db: typeof dbInstance;
  subscription: Stripe.Subscription;
  familyId: string;
}): Promise<void> {
  const { db, subscription, familyId } = args;
  const projected = projectSubscription(subscription);

  const [prior] = await db
    .select({
      graceEndsAt: familySubscription.graceEndsAt,
      plan: familySubscription.plan,
    })
    .from(familySubscription)
    .where(eq(familySubscription.familyId, familyId));

  const priorGraceEndsAt = prior?.graceEndsAt ?? null;
  const newGraceEndsAt = computeGraceEndsAt({
    status: projected.status,
    priorGraceEndsAt,
  });

  const startedGrace = graceJustStarted({
    status: projected.status,
    priorGraceEndsAt,
  });
  const recovered = graceJustEnded({
    status: projected.status,
    priorGraceEndsAt,
  });

  await db
    .update(familySubscription)
    .set({
      plan: projected.plan,
      status: projected.status,
      cadence: projected.cadence,
      stripeSubscriptionId: projected.stripeSubscriptionId,
      stripePriceId: projected.stripePriceId,
      currentPeriodStart: projected.currentPeriodStart,
      currentPeriodEnd: projected.currentPeriodEnd,
      cancelAtPeriodEnd: projected.cancelAtPeriodEnd,
      graceEndsAt: newGraceEndsAt,
      pendingCheckoutAt: null,
      updatedAt: new Date(),
    })
    .where(eq(familySubscription.familyId, familyId));

  if (startedGrace) {
    await sendBillingGraceStartedEmail({ familyId }).catch((err) => {
      console.error("[billing] grace-started email failed", err);
    });
  } else if (recovered) {
    await sendBillingRecoveredEmail({ familyId }).catch((err) => {
      console.error("[billing] recovered email failed", err);
    });
  }

  // Plan flipped to Individual via Stripe (canceled/expired) → notify.
  if (projected.plan === "individual" && prior?.plan === "family") {
    await sendBillingDowngradedEmail({ familyId }).catch((err) => {
      console.error("[billing] downgrade email failed", err);
    });
  }
}

/**
 * Mark a family as canceled/individual without a Stripe webhook (used when
 * the Stripe subscription is destroyed locally — e.g. family deletion).
 */
export async function markFamilyCanceled(
  db: typeof dbInstance,
  familyId: string,
): Promise<void> {
  await db
    .update(familySubscription)
    .set({
      plan: "individual",
      status: "canceled",
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
}
