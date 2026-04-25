/**
 * Pure mapping from a Stripe Subscription object to the columns we persist on
 * `family_subscription`. No Stripe SDK or DB calls — easy to unit test.
 */

import type Stripe from "stripe";

export const GRACE_PERIOD_DAYS = 7;

function cadenceFromPriceId(
  priceId: string | null,
): "monthly" | "annual" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_FAMILY_ANNUAL) return "annual";
  if (priceId === process.env.STRIPE_PRICE_FAMILY_MONTHLY) return "monthly";
  return null;
}

export type SubscriptionStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export type FamilyPlan = "individual" | "family";

const STATUSES_GRANTING_FAMILY = new Set<SubscriptionStatus>([
  "active",
  "trialing",
  "past_due", // still on Family plan during grace
  "unpaid", // still on Family plan during grace
]);

export interface ProjectedSubscription {
  plan: FamilyPlan;
  status: SubscriptionStatus;
  cadence: "monthly" | "annual" | null;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

function tsToDate(value: number | null | undefined): Date | null {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

export function projectSubscription(
  sub: Stripe.Subscription,
): ProjectedSubscription {
  const status = sub.status as SubscriptionStatus;
  const item = sub.items.data[0] ?? null;
  const priceId = item?.price.id ?? null;

  return {
    plan: STATUSES_GRANTING_FAMILY.has(status) ? "family" : "individual",
    status,
    cadence: cadenceFromPriceId(priceId),
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    currentPeriodStart: tsToDate(item?.current_period_start),
    currentPeriodEnd: tsToDate(item?.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

/**
 * Compute next `graceEndsAt` value given the projected status and the prior
 * grace timestamp. Caller persists the returned value.
 *
 *  - Enter past_due/unpaid with no prior grace → start the 7-day clock.
 *  - Recover (active/trialing) → clear grace.
 *  - Otherwise → keep the existing value (idempotent re-runs from webhooks).
 */
export function computeGraceEndsAt(args: {
  status: SubscriptionStatus;
  priorGraceEndsAt: Date | null;
  now?: Date;
}): Date | null {
  const { status, priorGraceEndsAt } = args;
  const now = args.now ?? new Date();

  if (status === "past_due" || status === "unpaid") {
    if (priorGraceEndsAt) return priorGraceEndsAt;
    const grace = new Date(now);
    grace.setUTCDate(grace.getUTCDate() + GRACE_PERIOD_DAYS);
    return grace;
  }
  if (status === "active" || status === "trialing") {
    return null;
  }
  return priorGraceEndsAt;
}

export function graceJustStarted(args: {
  status: SubscriptionStatus;
  priorGraceEndsAt: Date | null;
}): boolean {
  return (
    (args.status === "past_due" || args.status === "unpaid") &&
    args.priorGraceEndsAt === null
  );
}

export function graceJustEnded(args: {
  status: SubscriptionStatus;
  priorGraceEndsAt: Date | null;
}): boolean {
  return (
    (args.status === "active" || args.status === "trialing") &&
    args.priorGraceEndsAt !== null
  );
}
