# ADR-0017: Custom Stripe Integration over BetterAuth Plugin

## Status

Proposed

## Date

2026-04-25

## Context

Aurum needs subscription billing. Two integration paths:

1. `@better-auth/stripe` plugin — wired into the existing BetterAuth instance, manages a Stripe Customer per BetterAuth user, ships some helper endpoints out of the box.
2. Direct integration with the official `stripe` Node SDK — Checkout for new subscriptions, Customer Portal for management, a signed webhook to sync state into our DB.

The BetterAuth plugin is user-scoped, while our subscription scope is family-level (ADR-0016). Working around that would mean either (a) modeling a synthetic "billing user" per family, or (b) ignoring most of the plugin and reimplementing on top of it. Both add accidental complexity without a clear win.

## Decision

Use the **stripe SDK directly**:

- `src/server/billing/stripe.ts` exports a singleton `getStripe()` with a pinned API version.
- `src/server/api/routers/billing.ts` exposes tRPC mutations: `createCheckoutSession`, `createPortalSession`, `selectFree`, plus a `current` query.
- `src/app/api/stripe/webhook/route.ts` verifies signatures with `STRIPE_WEBHOOK_SECRET`, deduplicates events via `stripe_webhook_event` (id PK), and projects `customer.subscription.*` updates onto `family_subscription` via a pure `projection.ts` module.
- Stripe Checkout is used for new subscriptions; Stripe Customer Portal handles plan changes, cancellation, payment-method updates. We do not build custom forms.

## Consequences

- **Positive:** Family-level scope falls out naturally — `client_reference_id` on Checkout and `metadata.familyId` on the Subscription tie everything to a Family.
- **Positive:** Stripe-hosted UIs (Checkout + Portal) drastically reduce PCI scope and eliminate the need to build payment forms.
- **Positive:** Pure projection module is trivial to unit-test without mocking Stripe.
- **Trade-off:** We own the webhook/idempotency surface area. Mitigated by a small (≈100-line) handler.
- **Follow-up:** If we later need user-scoped features (e.g. add-ons that follow a user across families), we may revisit this decision.
