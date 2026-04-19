# ADR-0013: Use PostHog for Product Analytics and Error Monitoring

## Status

Proposed

## Date

2026-04-19

## Context

Aurum previously used Sentry (ADR-0002) purely for error monitoring and had no product analytics in place. As the product matures past MVP, we want visibility into both user behaviour (funnels, feature adoption, retention) and runtime errors, and we want both pieces of telemetry correlated against the same user identity so that errors can be investigated in the context of the flow the user was actually attempting.

Running two separate vendors — one for analytics and one for error monitoring — adds cost, duplicates user identification logic, and splits the investigation workflow across two dashboards. A single platform that handles both, in the EU region, keeps our data footprint smaller and the signal easier to correlate.

## Decision

Use [PostHog](https://posthog.com/) (EU cloud) as the single source of truth for product analytics **and** error monitoring, via the official `posthog-js` and `posthog-node` SDKs.

Configuration:

- Client-side init via Next.js's `instrumentation-client.ts`, with `capture_exceptions: true` to forward unhandled errors and promise rejections to PostHog automatically.
- Server-side error capture via Next.js's `instrumentation.ts` `onRequestError` hook, forwarding server errors through `posthog-node`.
- A `global-error.tsx` React error boundary at `src/app/global-error.tsx` calls `posthog.captureException` for render errors that escape other boundaries.
- PostHog traffic is reverse-proxied through Next.js at `/aurum-relay/*` to `https://eu.i.posthog.com` to improve ad-blocker resilience. The path is deliberately domain-specific — the common `/ingest/*` convention is on most blocklists.
- Configured via `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` (both optional; when unset, analytics and error capture are no-ops, which is the default in local development).
- User identity is attached on successful login via `posthog.identify()`.

This ADR supersedes [ADR-0002](0002-use-sentry-for-error-monitoring.md) (Sentry).

## Consequences

- **Positive:** One vendor, one user identity, one dashboard for both behavioural analytics and error investigation.
- **Positive:** Events instrumented during the PostHog wizard (login funnel, feature adoption, CSV import, etc.) are directly correlatable with errors for a given user.
- **Positive:** EU cloud keeps data inside the EU, simpler for GDPR posture given the Danish user base.
- **Positive:** Reverse-proxy setup avoids the majority of ad-blockers silently dropping analytics and error events.
- **Trade-off:** PostHog's error-monitoring product is younger than Sentry's; features like alerting rules, triage workflows, and source-map handling are less mature. Acceptable for MVP; revisit if error volume or triage burden grows.
- **Trade-off:** Removing Sentry removes automatic Session Replay-on-error. PostHog has its own replay product which can be enabled later if needed.
- **Follow-up:** Populate `NEXT_PUBLIC_POSTHOG_KEY` in staging and production environments. Consider enabling PostHog Session Replay once we have a concrete privacy review for capturing financial data screens.
