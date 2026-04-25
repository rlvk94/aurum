# ADR-0018: 7-Day Grace Period and Downgrade Policy

## Status

Proposed

## Date

2026-04-25

## Context

When a Pro family's payment fails (`past_due`, `unpaid`), we have to choose between:

- **Hard cut-off**: immediately drop them to Free. Risk: punishes families for transient bank issues; emotional churn.
- **Indefinite grace**: keep them on Pro until they manually cancel. Risk: free Pro forever for anyone whose payment quietly fails.
- **Time-boxed grace**: keep Pro for a fixed window, then downgrade.

We also need a way to enforce the cut-off. Two implementation options:

- **Cron-only**: scheduled job downgrades expired families. Can fail or run late.
- **On-read**: every request that needs the plan checks `graceEndsAt` and lazy-downgrades. Cheap and immediate but skips inactive families.

## Decision

**7-day grace period, then hard downgrade to Free, with both on-read and cron enforcement.**

- On entry to `past_due` or `unpaid`, the webhook sets `graceEndsAt = now() + 7 days` (idempotent: only when previously NULL) and sends a `billing-grace-started` email to all family owners.
- During grace, the family keeps Pro features (`projection.ts` keeps `plan='pro'` for `past_due`/`unpaid`).
- If the subscription recovers (`active`, `trialing`), `graceEndsAt` clears and a recovery email is sent.
- If `graceEndsAt` elapses with the subscription still failing, the family is downgraded to Free and a `billing-downgraded` email is sent.
- Enforcement: hybrid.
  - **On-read** (`getFamilySubscription`): cheap, immediate. Lazy-flips `plan='free'` when `graceEndsAt < now()` and the status is still failing.
  - **Cron backstop** (`/api/cron/billing-sweep`, header-token-protected with `CRON_SECRET`): catches families with no active sessions so the email goes out predictably. Runs daily.

## Consequences

- **Positive:** Forgives transient issues; predictable outcome for the user.
- **Positive:** On-read covers active users; cron covers silent ones — no single point of failure.
- **Positive:** All transitions trigger email notifications, fulfilling the user-confirmed requirement.
- **Trade-off:** Two enforcement paths. Both write the same end state, so divergence risk is limited to email duplication, which is mitigated by gating sends on the prior `plan` value.
- **Follow-up:** If churn analytics show we want a longer or shorter window, change `GRACE_PERIOD_DAYS` in `src/server/billing/projection.ts`. Schedule a routine to evaluate this after the first month of Pro signups.
