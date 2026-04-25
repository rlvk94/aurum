import "server-only";

import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import type { db as dbInstance } from "~/server/db";
import { familySubscription } from "~/server/db/schema";

import {
  PLAN_FEATURES,
  type BooleanFeatureKey,
  type NumericLimitKey,
  type PlanKey,
} from "./plans";
import { sendBillingDowngradedEmail } from "~/server/email/send";

export type EffectiveSubscription = {
  familyId: string;
  plan: PlanKey;
  status:
    | "none"
    | "active"
    | "trialing"
    | "past_due"
    | "unpaid"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "paused";
  cadence: "monthly" | "annual" | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  graceEndsAt: Date | null;
  pendingCheckout: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

const PENDING_CHECKOUT_TTL_MS = 30 * 60 * 1000;

/**
 * Returns the family's current subscription state, applying lazy on-read
 * downgrade if the 7-day grace window has elapsed. Side-effects: writes the
 * downgrade row + sends a notification email exactly once.
 */
export async function getFamilySubscription(
  db: typeof dbInstance,
  familyId: string,
): Promise<EffectiveSubscription> {
  const [row] = await db
    .select()
    .from(familySubscription)
    .where(eq(familySubscription.familyId, familyId));

  if (!row) {
    // Row should be backfilled at family creation; if missing, treat as Individual.
    return {
      familyId,
      plan: "individual",
      status: "none",
      cadence: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      graceEndsAt: null,
      pendingCheckout: false,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    };
  }

  const now = new Date();
  const lapsed =
    row.plan === "family" &&
    row.graceEndsAt !== null &&
    row.graceEndsAt.getTime() <= now.getTime() &&
    (row.status === "past_due" || row.status === "unpaid");

  if (lapsed) {
    await db
      .update(familySubscription)
      .set({ plan: "individual", updatedAt: now })
      .where(eq(familySubscription.familyId, familyId));

    void sendBillingDowngradedEmail({ familyId }).catch((err) => {
      console.error("[billing] downgrade email failed", err);
    });

    return {
      familyId,
      plan: "individual",
      status: row.status,
      cadence: row.cadence,
      currentPeriodEnd: row.currentPeriodEnd,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      graceEndsAt: row.graceEndsAt,
      pendingCheckout: false,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
    };
  }

  const pendingCheckout =
    row.pendingCheckoutAt !== null &&
    row.status === "none" &&
    now.getTime() - row.pendingCheckoutAt.getTime() < PENDING_CHECKOUT_TTL_MS;

  return {
    familyId,
    plan: row.plan,
    status: row.status,
    cadence: row.cadence,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    graceEndsAt: row.graceEndsAt,
    pendingCheckout,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
  };
}

export async function requireFeature(
  db: typeof dbInstance,
  familyId: string,
  feature: BooleanFeatureKey,
): Promise<void> {
  const sub = await getFamilySubscription(db, familyId);
  if (!PLAN_FEATURES[sub.plan][feature]) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "plan_upgrade_required",
      cause: { feature },
    });
  }
}

export async function requireWithinLimit(
  db: typeof dbInstance,
  familyId: string,
  key: NumericLimitKey,
  currentCount: number,
): Promise<void> {
  const sub = await getFamilySubscription(db, familyId);
  const limit = PLAN_FEATURES[sub.plan][key];
  if (currentCount >= limit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "plan_limit_reached",
      cause: { key, limit, currentCount },
    });
  }
}
