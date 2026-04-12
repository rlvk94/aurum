# CLAUDE.md — Project Context for AI-Assisted Development

This file is read automatically by Claude at the start of every session.
Keep it up to date as the project evolves.

## Product Overview

Aurum is a **multi-user family finance web application** for shared household and personal financial management. It combines account-based transaction tracking, weekly and monthly budgeting, debt tracking, asset tracking, net worth calculation, and income distribution planning.

The app replaces a combination of a spend-tracking app (like Spiir) and a custom finance spreadsheet. This is an **MVP** focused on a reliable, user-friendly core experience.

## Tech Stack

- **Framework:** Next.js (App Router)
- **API:** tRPC
- **ORM:** Drizzle ORM
- **Auth:** BetterAuth (email OTP only — no passwords)
- **Styling:** Tailwind CSS
- **Language:** TypeScript (strict mode)
- **Error monitoring:** Sentry
- **Testing:** Vitest

## Core Domain Model

All financial data is **family-scoped**. A user can belong to one or more families and switches between them.

### Key entities

- **User** — a person who signs in
- **Family** — a shared financial workspace
- **FamilyMember** — connects users to families (roles: `owner`, `member`)
- **Invitation** — email-based family invite with token and expiry
- **Account** — a financial account inside a family (checking, savings, cash, credit_card, e_wallet, other)
- **Transaction** — a financial activity tied to an account (types: `expense`, `income`, `transfer`)
- **Category** — classification for expenses or income (family-scoped, supports parent/child)
- **Budget** — a family budget for a weekly or monthly period
- **BudgetLine** — a category-based line within a budget with a planned amount
- **Debt** — a liability tracked for the family
- **Asset** — a manually tracked asset belonging to the family
- **IncomePlan** / **IncomePlanLine** — templates for allocating income (by percentage or fixed amount)
- **CategorizationRule** — keyword-to-category mapping for auto-categorization on import

### Financial semantics

- **Accounts** are transaction-based, have history, and may optionally be included in net worth
- **Assets** are manual valuations (car, property, investments) — not transaction-driven, included in net worth
- **Debts** are liabilities (loans) — separate from spending categories, included in net worth as negative
- **Net Worth** = Account Balances + Assets − Debts

## Business Rules

### Family scoping
- Every financial record belongs to a family
- A user must be a member of a family to access its data
- Queries, routes, pages, and mutations must always be scoped to the active family

### Transactions
- Expense reduces an account balance
- Income increases an account balance
- Transfer moves money between two accounts in the same family
- Transfers do **not** count as spending and do **not** affect budget actuals
- Only expense and income transactions need categories
- Transactions can be manually created or imported via CSV

### Budgets
- Support both **weekly** and **monthly** periods
- Budget lines are category-based
- Budget vs actual must be shown for both periods
- Weekly and monthly budgets should use the same underlying model

### Authentication
- Email OTP only — no password authentication
- 6-digit code, ~10 min expiry, resend with cooldown

## Implementation Phases

1. **Foundation** — auth, family model, family switching, membership checks, account model, category model
2. **Core financial tracking** — manual transactions, CSV import, transaction list/filters, categorization, account views
3. **Budgeting** — weekly budgets, monthly budgets, budget vs actual, overspending states
4. **Financial position** — debts, assets, net worth
5. **Planning** — income planner, rules refinement, UX improvements

## Routes / Screens

- Sign In / OTP Verification
- Family Overview / Family Switcher
- Dashboard
- Accounts
- Transactions
- Budgets
- Debts
- Net Worth
- Income Planner
- Family Settings

## Localization & Formatting

- Language: English
- Region: Denmark
- Timezone: Europe/Copenhagen
- Currency: `kr.` (e.g. `14.250 kr.`, `-486 kr.`)
- Decimal separator: comma
- Grouping separator: period

## Key Conventions

- All significant architectural decisions must be documented as an ADR in `docs/adr/` before implementation
- Tests are co-located with source files using `.test.ts` or `.spec.ts` suffixes
- Environment variables must be added to `.env.example` and validated in `src/env.js`
- Never commit `.env`
- Keep family scoping and permissions explicit in all data access
- Separate domain logic from UI where practical
- Prefer simple, clear solutions over over-engineering
- All financial data is manually entered or CSV-imported (no bank integrations in MVP)

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
- `0005` — Email OTP-only authentication
- `0006` — Family-scoped multi-tenancy
- `0007` — Manual-first financial data entry
- `0008` — Dual-period budgeting model

## Testing

- Test runner: Vitest
- Tests live alongside source files (e.g. `foo.ts` → `foo.test.ts`)
- Run tests: `npm test`
- Run with coverage: `npm run test:coverage`

## MVP Scope Boundaries

**In scope:** email OTP auth, family collaboration, account-based transactions, weekly/monthly budgets, debt/asset tracking, net worth, income planner, CSV import, manual data entry

**Out of scope for MVP:** automatic bank integrations (PSD2/Open Banking), real money transfers, bill payment, advanced forecasting, AI insights, tax reporting, native mobile app, complex permissions beyond owner/member

## What AI Should Never Do

- Configure or modify the production deployment pipeline
- Commit or expose secrets or credentials
- Create ADRs with status "Accepted" without explicit human confirmation
- Introduce bank integration or PSD2 features
- Add authentication methods beyond email OTP
