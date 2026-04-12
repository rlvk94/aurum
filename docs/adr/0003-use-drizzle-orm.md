# ADR-0003: Use Drizzle ORM

## Status

Accepted

## Date

2026-04-12

## Context

The application needs a database access layer that provides type safety, supports PostgreSQL, and integrates well with the T3 Stack. Common alternatives include Prisma, TypeORM, and Knex.

Key evaluation criteria:

- **Type safety** without requiring a separate code generation step during development
- **SQL-like syntax** that maps closely to the underlying queries, reducing the abstraction gap
- **Runtime footprint** — the ORM should add minimal overhead to cold starts and bundle size
- **Ecosystem fit** — must integrate cleanly with Next.js, tRPC, and BetterAuth

## Decision

Use [Drizzle ORM](https://orm.drizzle.team/) as the database access layer, with `drizzle-kit` for schema migrations.

- `src/server/db/schema.ts` is the single source of truth for all table definitions.
- `src/server/db/index.ts` exports the initialized Drizzle client.
- `drizzle.config.ts` at the project root configures `drizzle-kit` with `DATABASE_URL`.
- Migration scripts: `db:generate`, `db:migrate`, `db:studio`.

## Consequences

- **Positive:** Explicit, SQL-like query syntax means developers can reason about generated queries without learning a custom DSL.
- **Positive:** Type safety is derived directly from the schema definition — no code generation step needed during development.
- **Positive:** Lighter runtime footprint compared to Prisma (no query engine binary, smaller node_modules).
- **Positive:** First-class support as a BetterAuth adapter, simplifying auth table management.
- **Trade-off:** Drizzle's ecosystem is younger than Prisma's; some edge-case patterns may have less documentation or community support.
- **Trade-off:** Developers accustomed to Prisma's higher-level abstractions (e.g., nested writes) will need to adjust to Drizzle's more explicit approach.
