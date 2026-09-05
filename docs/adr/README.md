# Architecture Decision Records (ADRs)

All significant architectural decisions for this project must be documented here as an ADR **before implementation**.

## Format

Each ADR is a Markdown file named `XXXX-short-title.md` using the following template:

```markdown
# ADR-XXXX: [Title]

## Status

[Proposed | Accepted | Deprecated | Superseded]

## Date

YYYY-MM-DD

## Context

[Why is this decision needed? What problem are we solving?]

## Decision

[What was decided?]

## Consequences

[What are the trade-offs, implications, or follow-up actions?]
```

## Process

1. Create a new ADR file with the next sequential number.
2. Set the status to **Proposed**.
3. Submit a pull request for team review.
4. Once approved, update the status to **Accepted**.
5. Update `CLAUDE.md` at the project root to reference the new ADR.

## Index

| ADR  | Title                                                                                                            | Status     |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ---------- |
| 0001 | [Use T3 Stack](0001-use-t3-stack.md)                                                                             | Accepted   |
| 0002 | [Use Sentry for Error Monitoring](0002-use-sentry-for-error-monitoring.md)                                       | Superseded |
| 0003 | [Use Drizzle ORM](0003-use-drizzle-orm.md)                                                                       | Accepted   |
| 0004 | [Use BetterAuth](0004-use-betterauth.md)                                                                         | Accepted   |
| 0005 | [Email OTP-Only Authentication](0005-email-otp-only-auth.md)                                                     | Accepted   |
| 0006 | [Family-Scoped Multi-Tenancy](0006-family-scoped-multi-tenancy.md)                                               | Accepted   |
| 0007 | [Manual-First Financial Data Entry](0007-manual-first-data-entry.md)                                             | Accepted   |
| 0008 | [Annual Budget with Spending Challenges](0008-dual-period-budgeting.md)                                          | Accepted   |
| 0009 | [Use shadcn/ui as Component Library](0009-use-shadcn-ui.md)                                                      | Accepted   |
| 0010 | [Aurum Design System from Lovable Prototype](0010-aurum-design-system.md)                                        | Accepted   |
| 0011 | [Use next-intl for Internationalization](0011-use-next-intl.md)                                                  | Proposed   |
| 0012 | [All User-Facing Text Must Use Translation Keys](0012-translatable-labels.md)                                    | Proposed   |
| 0013 | [Use PostHog for Product Analytics and Error Monitoring](0013-use-posthog-for-analytics-and-error-monitoring.md) | Proposed   |
| 0014 | [Projects as a Transaction Dimension](0014-projects-as-transaction-dimension.md)                                 | Proposed   |
| 0015 | [In-App Announcements as Bundled Content](0015-in-app-announcements.md)                                          | Proposed   |
| 0016 | [Family-Level Stripe Subscriptions](0016-family-level-stripe-subscriptions.md)                                   | Proposed   |
| 0017 | [Custom Stripe Integration over BetterAuth Plugin](0017-custom-stripe-integration.md)                            | Proposed   |
| 0018 | [7-Day Grace Period and Downgrade Policy](0018-grace-period-downgrade-policy.md)                                 | Proposed   |
| 0019 | [Centralized Plan-Entitlements Module](0019-plan-entitlements-module.md)                                         | Proposed   |
| 0020 | [Stripe Price IDs via Environment Variables](0020-stripe-prices-via-env.md)                                      | Proposed   |
| 0022 | [Discount Codes at Checkout](0022-discount-codes-at-checkout.md)                                                 | Proposed   |
| 0023 | [Terms & Conditions Acceptance with Versioned Snapshots](0023-terms-and-conditions-acceptance.md)                | Proposed   |
| 0024 | [Split Transactions](0024-split-transactions.md)                                                                 | Proposed   |
| 0025 | [Multi-Channel Notification System](0025-multi-channel-notifications.md)                                         | Proposed   |
| 0026 | [Consumption Tracker (Utility Meter Readings)](0026-consumption-tracker.md)                                      | Proposed   |
