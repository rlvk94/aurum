# ADR-0004: Use BetterAuth

## Status

Accepted

## Date

2026-04-12

## Context

The application requires user authentication with support for email/password and social providers (starting with GitHub). The solution must integrate with our existing Drizzle ORM setup and the Next.js App Router.

NextAuth.js (Auth.js) is the most widely adopted option in the Next.js ecosystem, but it has known pain points: complex adapter configuration, inconsistent TypeScript types across versions, and a migration-heavy upgrade path between major versions.

We evaluated BetterAuth as an alternative that addresses these concerns.

## Decision

Use [BetterAuth](https://www.better-auth.com/) for authentication, configured with the Drizzle adapter.

- `src/server/better-auth/config.ts` initializes BetterAuth with the Drizzle adapter and provider configuration.
- `src/app/api/auth/[...all]/route.ts` handles all auth API routes.
- `src/server/better-auth/client.ts` provides a client-side auth helper via `createAuthClient()`.
- Auth tables (`user`, `session`, `account`, `verification`) are defined in the shared Drizzle schema.

## Consequences

- **Positive:** Framework-agnostic design — BetterAuth is not coupled to Next.js internals, making it portable if the framework layer changes.
- **Positive:** First-class Drizzle adapter support means auth tables live in the same schema as application tables, with shared migrations and type safety.
- **Positive:** Improved TypeScript ergonomics compared to NextAuth.js — session types are inferred directly from the configuration, reducing manual type wrangling.
- **Positive:** Built-in support for email/password and social providers without additional packages.
- **Trade-off:** Smaller community and ecosystem compared to NextAuth.js; fewer third-party tutorials and integrations available.
- **Trade-off:** As a newer library, BetterAuth may encounter breaking changes more frequently than the mature NextAuth.js.
- **Follow-up:** Social provider credentials (GitHub OAuth) must be provisioned manually by the team and added to `.env`.
