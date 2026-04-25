# ADR-0019: Centralized Plan-Entitlements Module

## Status

Proposed

## Date

2026-04-25

## Context

Plan-based feature gating must be enforced in two places: server-side (so Pro-only mutations cannot be called by Free-tier users) and client-side (so Pro-only UI surfaces are hidden / show upgrade prompts). Without a single source of truth, server and client drift — UI shows a feature that the API rejects, or vice versa.

We considered:

1. **Hard-coded checks at each call site** — fast to write, impossible to audit, drifts immediately.
2. **Database-driven entitlements table** — extra table, extra queries, deployment coupling for what is essentially a constant.
3. **Single TypeScript config module** — pure, dep-free, importable from server and client.

## Decision

Define `PLAN_FEATURES` in `src/server/billing/plans.ts` as the **single source of truth** for plan capabilities:

```ts
export const PLAN_FEATURES = {
  free: { maxAccounts: 2, annualBudgets: false, challenges: false, ... },
  pro:  { maxAccounts: Infinity, annualBudgets: true, challenges: true, ... },
} as const;
```

- **Server-side gating**: `requireFeature(db, familyId, key)` and `requireWithinLimit(db, familyId, key, currentCount)` in `src/server/billing/entitlements.ts`. Throw `TRPCError({ code: 'FORBIDDEN', message: 'plan_upgrade_required' | 'plan_limit_reached' })` so clients can intercept and surface an upgrade modal.
- **Client-side gating**: `useEntitlements()` hook in `src/app/_hooks/use-entitlements.ts` wraps `api.billing.current` and exposes `has(feature)` / `limit(key)` for nav items, dashboards, and upgrade modals.
- The module is **pure and dep-free** so the same constants can be imported from a React client component and from a tRPC router without runtime divergence.

Helper-not-middleware style: matches existing `requireOwner` pattern in `src/server/api/routers/family.ts` (helpers called explicitly inside procedures, not added as global tRPC middleware). Avoids hidden control flow in the router definitions.

## Consequences

- **Positive:** One place to change plan capabilities. Server and client never drift.
- **Positive:** TypeScript autocomplete on every feature key — no string typos.
- **Positive:** Easy to extend with new feature keys without touching the framework.
- **Trade-off:** `Infinity` for unlimited values. Loses literal type information (`number` instead of a specific value), but explicit tests and linting catch misuse.
- **Follow-up:** Any new Pro-only feature must update `PLAN_FEATURES` and add `requireFeature` calls at the server entry points.
