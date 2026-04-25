# ADR-0016: Family-Level Stripe Subscriptions

## Status

Proposed

## Date

2026-04-25

## Context

The landing page sells a "Family" Pro plan whose value proposition is that the entire household shares the same paid features. Aurum has two natural billing scopes:

1. **User-level**: each user pays for their own Pro features. Members of the same family could end up on different tiers, with confusing UI and partial entitlements.
2. **Family-level**: one subscription per family. The owner pays. Every member of that family inherits the plan.

The product copy ("Hele familien" / "whole family") implies family-level. Family-level also matches our existing data model where Family is the primary scoping unit (ADR-0006).

BetterAuth ships an official `@better-auth/stripe` plugin, but it is user-scoped and would require workarounds to associate a Stripe Customer with a Family.

## Decision

Use a **family-level subscription model**:

- One Stripe Customer per Family. `stripe_customer_id` lives on `family_subscription` (1:1 with `family`).
- One Stripe Subscription per Family.
- Only the family **owner** can manage billing (open Checkout / Customer Portal).
- Members see read-only billing state and a "ask the family owner" notice in `/settings/billing`.
- Plan/status applied uniformly to every family member via the entitlements module (ADR-0019).
- When a user belongs to multiple families, switching active family switches the effective plan automatically (no per-user override).

## Consequences

- **Positive:** Matches landing-page copy. Single source of truth per family. Mirrors existing family scoping pattern.
- **Positive:** Pricing simpler — no member-count tiers in MVP, just per-family monthly/annual.
- **Trade-off:** Owners absorb the cost for the family — no built-in cost-sharing UI. Acceptable for MVP.
- **Trade-off:** A user who owns multiple families pays separately for each. Acceptable.
- **Follow-up:** Family delete and last-owner-leave paths must reconcile the Stripe subscription (cancel before destroying the row). The existing "cannot leave as last owner" guard already covers the leave case for families with multiple members.
