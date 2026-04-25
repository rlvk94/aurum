import "server-only";

import Stripe from "stripe";

import { env } from "~/env";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set — billing features are unavailable",
    );
  }
  stripeSingleton = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
    appInfo: { name: "Aurum", version: "1.0.0" },
  });
  return stripeSingleton;
}

export type BillingCadence = "monthly" | "annual";

export function priceIdFor(cadence: BillingCadence): string {
  const id =
    cadence === "annual"
      ? env.STRIPE_PRICE_FAMILY_ANNUAL
      : env.STRIPE_PRICE_FAMILY_MONTHLY;
  if (!id) {
    throw new Error(
      `Stripe price for cadence "${cadence}" is not configured (set STRIPE_PRICE_FAMILY_${cadence === "annual" ? "ANNUAL" : "MONTHLY"})`,
    );
  }
  return id;
}

export function cadenceFromPriceId(priceId: string | null): BillingCadence | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_FAMILY_ANNUAL) return "annual";
  if (priceId === env.STRIPE_PRICE_FAMILY_MONTHLY) return "monthly";
  return null;
}
