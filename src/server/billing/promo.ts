/**
 * Pure mapping from a Stripe PromotionCode to the discount terms we surface at
 * checkout. No Stripe SDK or DB calls — easy to unit test. The router does the
 * `stripe.promotionCodes.list(...)` lookup and hands the first result here.
 */

import type Stripe from "stripe";

export type PromoValidation =
  | { valid: false }
  | {
      valid: true;
      /** Canonical code as stored in Stripe (preserves Stripe's casing). */
      code: string;
      /** Stripe promotion code id (`promo_…`) — used server-side to apply. */
      promotionCodeId: string;
      percentOff: number | null;
      /** Fixed discount in minor units (e.g. øre), paired with `currency`. */
      amountOff: number | null;
      currency: string | null;
      duration: Stripe.Coupon.Duration;
    };

/**
 * Validate a looked-up promotion code. Returns `{ valid: false }` when the code
 * is missing, inactive, or its coupon is no longer redeemable — otherwise the
 * discount terms for display and the id for application.
 */
export function validatePromotionCode(
  promo: Stripe.PromotionCode | undefined | null,
): PromoValidation {
  if (!promo?.active) return { valid: false };
  // `promotion.coupon` is `string | Coupon | null` — require an expanded,
  // still-redeemable Coupon object (the router expands it on lookup).
  const coupon = promo.promotion?.coupon;
  if (!coupon || typeof coupon === "string" || !coupon.valid) {
    return { valid: false };
  }

  return {
    valid: true,
    code: promo.code,
    promotionCodeId: promo.id,
    percentOff: coupon.percent_off ?? null,
    amountOff: coupon.amount_off ?? null,
    currency: coupon.currency ?? null,
    duration: coupon.duration,
  };
}
