# ADR-0002: Use Sentry for Error Monitoring

## Status

Accepted

## Date

2026-04-12

## Context

Production applications need real-time error tracking and performance monitoring to detect, diagnose, and resolve issues before they impact users. Without centralized error monitoring, bugs surface only through user reports or manual log inspection, both of which are slow and unreliable.

We need a solution that integrates with Next.js (both server and client), supports source maps for readable stack traces, and provides environment-based tagging to distinguish development, staging, and production errors.

## Decision

Use [Sentry](https://sentry.io/) via the `@sentry/nextjs` SDK for error monitoring across the application.

Configuration includes:

- Separate `sentry.server.config.ts` and `sentry.client.config.ts` initialization files
- Source maps enabled for production builds
- Environment tagging via `NEXT_PUBLIC_APP_ENV` (development, staging, production)
- DSN configured through the `SENTRY_DSN` environment variable

## Consequences

- **Positive:** Automatic capture of unhandled exceptions and promise rejections on both server and client, with full stack traces and context.
- **Positive:** Source map upload ensures production errors are readable despite minification.
- **Positive:** Environment tagging allows filtering noise from development/staging when triaging production issues.
- **Trade-off:** Adds a third-party dependency and a small runtime overhead for error capture and breadcrumb collection.
- **Trade-off:** Requires a Sentry account and project to be provisioned (handled manually by the team, not by CI).
- **Follow-up:** The team must create a Sentry project and populate `SENTRY_DSN` before deploying to staging/production.
