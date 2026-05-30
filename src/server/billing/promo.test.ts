import { describe, expect, it } from "vitest";
import type Stripe from "stripe";

import { validatePromotionCode } from "./promo";

function promo(overrides: {
  active?: boolean;
  /** `null` → no coupon; `"id"` → unexpanded id string; object → expanded. */
  coupon?: Partial<Stripe.Coupon> | string | null;
  code?: string;
  id?: string;
}): Stripe.PromotionCode {
  const coupon =
    overrides.coupon === undefined
      ? ({
          valid: true,
          percent_off: 20,
          amount_off: null,
          currency: null,
          duration: "once",
        } as Stripe.Coupon)
      : typeof overrides.coupon === "object" && overrides.coupon !== null
        ? ({
            valid: true,
            percent_off: 20,
            amount_off: null,
            currency: null,
            duration: "once",
            ...overrides.coupon,
          } as Stripe.Coupon)
        : overrides.coupon;

  return {
    id: overrides.id ?? "promo_123",
    code: overrides.code ?? "WELCOME20",
    active: overrides.active ?? true,
    promotion: { type: "coupon", coupon },
  } as unknown as Stripe.PromotionCode;
}

describe("validatePromotionCode", () => {
  it("returns invalid for a missing promotion code", () => {
    expect(validatePromotionCode(undefined)).toEqual({ valid: false });
    expect(validatePromotionCode(null)).toEqual({ valid: false });
  });

  it("returns invalid for an inactive promotion code", () => {
    expect(validatePromotionCode(promo({ active: false }))).toEqual({
      valid: false,
    });
  });

  it("returns invalid when the coupon is missing or no longer valid", () => {
    expect(validatePromotionCode(promo({ coupon: null }))).toEqual({
      valid: false,
    });
    expect(
      validatePromotionCode(promo({ coupon: { valid: false } })),
    ).toEqual({ valid: false });
  });

  it("returns invalid when the coupon is an unexpanded id string", () => {
    expect(validatePromotionCode(promo({ coupon: "co_123" }))).toEqual({
      valid: false,
    });
  });

  it("maps a percent-off coupon to display terms and id", () => {
    const result = validatePromotionCode(
      promo({
        id: "promo_abc",
        code: "WELCOME20",
        coupon: { percent_off: 20, duration: "repeating" },
      }),
    );

    expect(result).toEqual({
      valid: true,
      code: "WELCOME20",
      promotionCodeId: "promo_abc",
      percentOff: 20,
      amountOff: null,
      currency: null,
      duration: "repeating",
    });
  });

  it("maps a fixed amount-off coupon with currency", () => {
    const result = validatePromotionCode(
      promo({
        coupon: {
          percent_off: null,
          amount_off: 5000,
          currency: "dkk",
          duration: "once",
        },
      }),
    );

    expect(result).toMatchObject({
      valid: true,
      percentOff: null,
      amountOff: 5000,
      currency: "dkk",
    });
  });
});
