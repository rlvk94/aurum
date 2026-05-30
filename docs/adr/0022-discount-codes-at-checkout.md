# ADR-0022: Discount Codes at Checkout (Stripe Promotion Codes)

## Status

Proposed

## Date

2026-05-30

## Context

We want to let a family apply a discount code when subscribing to the Pro
(family) plan — for launch promos, referrals, and win-back offers. Today the
checkout flow (`billing.createSubscription`) creates an incomplete subscription
and confirms the first payment through embedded Stripe Elements
(`<PaymentElement />`), with no place to enter a code.

Stripe models discounts in two layers:

- **Coupon** — the discount itself (percent-off or fixed amount, currency,
  duration: once / repeating / forever, optional redemption limits).
- **Promotion Code** — a customer-facing string (e.g. `WELCOME20`) that maps to
  a coupon, with its own restrictions (active flag, max redemptions, expiry,
  first-time-customer-only, minimum amount).

Because we use embedded Elements rather than Stripe-hosted Checkout, Stripe's
built-in promo-code field is not available — the code must be validated and
applied through the API.

Key questions:

1. **Where do coupons/promo codes live?** Authoring them in our own DB +
   admin UI duplicates what the Stripe Dashboard already does well, with no
   payoff for an MVP.
2. **Do we persist applied discounts in our DB?** We already mirror only the
   minimum subscription state needed for entitlement gating; the discount does
   not affect which plan a family is on.
3. **How is the code applied given the existing reuse-of-incomplete-subscription
   optimization?**

## Decision

Support discount codes via **Stripe Promotion Codes, authored in the Stripe
Dashboard**, applied at checkout through the API. We do **not** build coupon
management or persist discount state in our own database for now.

- **Authoring:** coupons and promotion codes are created/managed in the Stripe
  Dashboard (test mode for dev/staging, live mode for production). No app code,
  schema, or env vars for the codes themselves.
- **Validation:** a new tRPC query `billing.validatePromoCode(code)` resolves the
  string via `stripe.promotionCodes.list({ code, active: true, limit: 1 })`,
  checks the embedded coupon is `valid`, and returns the discount terms
  (`percentOff` / `amountOff` + `currency` + `duration`) for display — or a typed
  "invalid" result. Input is upper-cased before lookup.
- **Application:** `billing.createSubscription` accepts an optional `promoCode`.
  The server **re-resolves** the code (never trusts a client-supplied promotion
  code id) and passes `discounts: [{ promotion_code: <id> }]` to
  `stripe.subscriptions.create(...)`.
- **Reuse interaction:** when a `promoCode` is supplied, the
  reuse-existing-incomplete-subscription branch is **skipped** — we always cancel
  and recreate so the discount is guaranteed applied (we do not persist which
  promo a draft already carries). The no-promo path keeps the existing reuse
  optimization unchanged.
- **Persistence:** none. The discount lives entirely in Stripe (subscription /
  invoice). `family_subscription` is unchanged; the webhook projection
  (`projection.ts` / `lifecycle.ts`) is untouched — plan/status/cadence are
  independent of any discount.
- **Portal:** the Stripe Customer Portal already exposes promo-code entry where
  enabled; no custom work there.

## Consequences

- **Positive:** Zero new schema, env vars, or admin tooling. Marketing manages
  codes in Stripe directly.
- **Positive:** Discount math, redemption limits, expiry, and stacking rules are
  all enforced by Stripe — we don't reimplement them.
- **Positive:** Entitlement logic is untouched; a discount can never change which
  features a family gets.
- **Trade-off:** We can't render "you currently have 20% off" inside Aurum
  without a follow-up that reads the discount back from Stripe (or persists it).
  Acceptable for launch — the discount is visible on the Stripe invoice/receipt.
- **Trade-off:** Validation costs one extra Stripe API call before checkout. Low
  volume, off the hot path.
- **Trade-off:** Supplying a promo always recreates the draft subscription
  (loses the reuse optimization for that case). Harmless — the recreate path
  already cancels the prior draft first, so no pile-up.
- **Follow-up:** If we later want in-app discount display, recurring-discount
  badges, or self-serve coupon authoring, revisit and add a
  `family_subscription` discount snapshot fed by the webhook projection.
