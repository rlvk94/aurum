# ADR-0020: Stripe Price IDs via Environment Variables

## Status

Proposed

## Date

2026-04-25

## Context

Stripe Price IDs (`price_*`) identify the per-cadence product variants the Pro plan checks out against. We need a way to map the cadence the user picks (`monthly` / `annual`) to the right `price_id`, with separate values for test-mode (dev/staging) and live-mode (production).

Options:

1. **Database seeds** — store prices in a `pricing` table and seed per environment. Adds a migration path each time we change pricing, plus another query on the hot path.
2. **Env vars** — `STRIPE_PRICE_PRO_MONTHLY` and `STRIPE_PRICE_PRO_ANNUAL` resolved per environment via `src/env.js`.
3. **Hard-coded** — bake price IDs into source. Dangerous: a leaked dev key + live IDs would charge real cards.

## Decision

Store Stripe Price IDs in **environment variables**, validated by `src/env.js`:

- `STRIPE_PRICE_PRO_MONTHLY` and `STRIPE_PRICE_PRO_ANNUAL` are required in production, optional in development.
- `priceIdFor(cadence)` in `src/server/billing/stripe.ts` resolves the right ID at call time.
- The reverse mapping `cadenceFromPriceId(id)` is used by the webhook projection to set `family_subscription.cadence` based on the active subscription's price.

Pricing is **global**, not family-specific, and changes infrequently. Storing it in env keeps deploy and config in lockstep without an extra DB table.

## Consequences

- **Positive:** Test and live prices are isolated by environment automatically.
- **Positive:** No DB call on the billing hot path.
- **Positive:** Rotating prices is one config change per environment.
- **Trade-off:** Adding a new tier (e.g. a "Pro Plus") requires a new env var, not just a DB row. Acceptable while the tier count stays small.
- **Follow-up:** If we ever introduce per-customer pricing (custom enterprise tiers), revisit this. Until then, env wins on simplicity.
