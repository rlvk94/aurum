# CLAUDE.md — Project Context for AI-Assisted Development

This file is read automatically by Claude at the start of every session.
Keep it up to date as the project evolves.

## Project Overview

[Short description of what this application does — fill in when known]

## Tech Stack

- **Framework:** Next.js (App Router)
- **API:** tRPC
- **ORM:** Drizzle ORM
- **Auth:** BetterAuth
- **Styling:** Tailwind CSS
- **Language:** TypeScript (strict mode)
- **Error monitoring:** Sentry

## Key Conventions

- All significant architectural decisions must be documented as an ADR in `docs/adr/` before implementation
- Tests are co-located with source files using `.test.ts` or `.spec.ts` suffixes
- Environment variables must be added to `.env.example` and validated in `src/env.js`
- Never commit `.env`

## Folder Structure

- `src/server/db/` — Drizzle schema and database client
- `src/server/api/` — tRPC routers and procedures
- `src/server/better-auth/` — BetterAuth server configuration
- `src/lib/auth-client.ts` — BetterAuth client helper
- `src/app/` — Next.js App Router pages and layouts
- `docs/adr/` — Architecture Decision Records

## ADR Index

- `0001` — Use T3 Stack
- `0002` — Use Sentry for error monitoring
- `0003` — Use Drizzle ORM
- `0004` — Use BetterAuth

## Testing

- Test runner: Vitest
- Tests live alongside source files (e.g. `foo.ts` → `foo.test.ts`)
- Run tests: `npm test`
- Run with coverage: `npm run test:coverage`

## What AI Should Never Do

- Configure or modify the production deployment pipeline
- Commit or expose secrets or credentials
- Create ADRs with status "Accepted" without explicit human confirmation
