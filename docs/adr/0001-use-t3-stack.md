# ADR-0001: Use T3 Stack

## Status

Accepted

## Date

2026-04-12

## Context

We need a solid foundation for a production-ready, full-stack TypeScript web application. The project requires server-side rendering, type-safe API communication, modern styling, and a robust ORM — all with strong TypeScript integration.

Evaluating options from scratch (manually assembling Next.js + tRPC + Tailwind + ORM) introduces risk of misconfiguration and inconsistent patterns. We need a well-maintained, opinionated scaffold that enforces best practices out of the box.

## Decision

Use the [T3 Stack](https://create.t3.gg/) (`create-t3-app`) as the project foundation. The scaffold includes:

- **Next.js** (App Router) for the framework layer
- **tRPC** for end-to-end type-safe APIs
- **Tailwind CSS** for utility-first styling
- **Drizzle ORM** for database access
- **TypeScript** in strict mode throughout

## Consequences

- **Positive:** Consistent project structure, strong community support, type safety across the full stack, and fast onboarding for developers familiar with the T3 ecosystem.
- **Positive:** The scaffold handles integration wiring (tRPC + React Query, env validation, path aliases) so the team can focus on business logic.
- **Trade-off:** The team is coupled to T3's opinionated defaults. Deviating from these conventions (e.g., replacing tRPC with REST) would require significant rework.
- **Follow-up:** All subsequent architectural choices (ORM, auth, monitoring) must integrate cleanly with the T3 foundation and be documented as their own ADRs.
