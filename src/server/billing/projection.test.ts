import { describe, it, expect } from "vitest";
import type Stripe from "stripe";

import {
  computeGraceEndsAt,
  graceJustEnded,
  graceJustStarted,
  GRACE_PERIOD_DAYS,
  projectSubscription,
} from "./projection";

function buildSubscription(
  overrides: Partial<Stripe.Subscription> & {
    status?: Stripe.Subscription.Status;
    priceId?: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodStart?: number;
    currentPeriodEnd?: number;
  } = {},
): Stripe.Subscription {
  const {
    status = "active",
    priceId = "price_monthly_test",
    cancelAtPeriodEnd = false,
    currentPeriodStart = 1_700_000_000,
    currentPeriodEnd = 1_702_592_000,
    ...rest
  } = overrides;
  return {
    id: "sub_123",
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    items: {
      data: [
        {
          price: { id: priceId } as unknown as Stripe.Price,
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
        } as unknown as Stripe.SubscriptionItem,
      ],
    } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>,
    ...rest,
  } as unknown as Stripe.Subscription;
}

describe("projectSubscription", () => {
  it("maps active → plan=family", () => {
    const projected = projectSubscription(buildSubscription({ status: "active" }));
    expect(projected.plan).toBe("family");
    expect(projected.status).toBe("active");
  });

  it("keeps plan=family during past_due (grace period semantics)", () => {
    const projected = projectSubscription(
      buildSubscription({ status: "past_due" }),
    );
    expect(projected.plan).toBe("family");
    expect(projected.status).toBe("past_due");
  });

  it("maps canceled → plan=individual", () => {
    const projected = projectSubscription(
      buildSubscription({ status: "canceled" }),
    );
    expect(projected.plan).toBe("individual");
  });

  it("maps incomplete → plan=individual", () => {
    const projected = projectSubscription(
      buildSubscription({ status: "incomplete" }),
    );
    expect(projected.plan).toBe("individual");
  });

  it("propagates current period and cancel flag", () => {
    const projected = projectSubscription(
      buildSubscription({
        currentPeriodStart: 1,
        currentPeriodEnd: 60,
        cancelAtPeriodEnd: true,
      }),
    );
    expect(projected.currentPeriodStart).toEqual(new Date(1000));
    expect(projected.currentPeriodEnd).toEqual(new Date(60_000));
    expect(projected.cancelAtPeriodEnd).toBe(true);
  });
});

describe("computeGraceEndsAt", () => {
  const now = new Date("2026-04-25T00:00:00Z");

  it("starts a 7-day clock when entering past_due with no prior grace", () => {
    const next = computeGraceEndsAt({
      status: "past_due",
      priorGraceEndsAt: null,
      now,
    });
    expect(next).toEqual(new Date("2026-05-02T00:00:00Z"));
  });

  it("preserves the existing grace deadline on subsequent past_due updates", () => {
    const existing = new Date("2026-04-30T00:00:00Z");
    const next = computeGraceEndsAt({
      status: "past_due",
      priorGraceEndsAt: existing,
      now,
    });
    expect(next).toEqual(existing);
  });

  it("clears grace when recovering to active", () => {
    const existing = new Date("2026-04-30T00:00:00Z");
    expect(
      computeGraceEndsAt({
        status: "active",
        priorGraceEndsAt: existing,
        now,
      }),
    ).toBeNull();
  });

  it("uses the configured grace period length", () => {
    expect(GRACE_PERIOD_DAYS).toBe(7);
  });

  it("leaves grace untouched when status is unrelated (canceled)", () => {
    const existing = new Date("2026-04-30T00:00:00Z");
    expect(
      computeGraceEndsAt({
        status: "canceled",
        priorGraceEndsAt: existing,
        now,
      }),
    ).toEqual(existing);
  });
});

describe("graceJustStarted / graceJustEnded", () => {
  it("detects start when entering past_due without prior grace", () => {
    expect(
      graceJustStarted({ status: "past_due", priorGraceEndsAt: null }),
    ).toBe(true);
    expect(
      graceJustStarted({ status: "past_due", priorGraceEndsAt: new Date() }),
    ).toBe(false);
  });

  it("detects recovery when transitioning back to active with grace set", () => {
    expect(
      graceJustEnded({ status: "active", priorGraceEndsAt: new Date() }),
    ).toBe(true);
    expect(
      graceJustEnded({ status: "active", priorGraceEndsAt: null }),
    ).toBe(false);
  });
});
