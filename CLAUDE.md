# CLAUDE.md — Project Context for AI-Assisted Development

This file is read automatically by Claude at the start of every session.
Keep it up to date as the project evolves.

## Product Overview

Aurum is a **multi-user family finance web application** for shared household and personal financial management. It combines account-based transaction tracking, annual budgeting with monthly breakdown, spending challenges, debt tracking, asset tracking, net worth calculation, and income distribution planning.

The app replaces a combination of a spend-tracking app (like Spiir) and a custom finance spreadsheet. This is an **MVP** focused on a reliable, user-friendly core experience.

## Tech Stack

- **Framework:** Next.js (App Router)
- **API:** tRPC
- **ORM:** Drizzle ORM
- **Auth:** BetterAuth (email OTP only — no passwords)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Language:** TypeScript (strict mode)
- **i18n:** next-intl (Danish default, English)
- **Product analytics & error monitoring:** PostHog (EU cloud)
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
- **Budget** — an annual family budget broken down into 12 monthly columns
- **BudgetLine** — a category-based line with a planned amount and recurrence pattern (monthly, quarterly, semi_annual, annual, custom)
- **Challenge** — a time-boxed spending goal with flexible duration (e.g. 1 week, 2 weeks, 1 month)
- **Debt** — a liability tracked for the family
- **Asset** — a manually tracked asset belonging to the family
- **IncomePlan** / **IncomePlanLine** — templates for allocating income (by percentage or fixed amount)
- **Category keywords** — each Category carries a `keywords` array used for auto-categorization on transaction create / CSV import. Implemented in `src/server/api/routers/category.ts` (`findMatchingCategoryId`, `loadCategoriesWithKeywords`); applied in `transaction.ts` on insert and via a bulk re-categorise mutation. Matches against leaf categories only, longest keyword wins.

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
- A budget covers a **full year**, with planned amounts distributed across 12 months
- Budget lines have a **recurrence** (monthly, quarterly, semi_annual, annual, custom) that determines per-month distribution
- Budget vs actual is shown for the current month (planned vs categorized expense transactions)
- Transfer transactions are excluded from budget actuals

### Challenges
- Time-boxed spending goals with flexible duration (1 week, 2 weeks, 1 month, or custom)
- Independent of the annual budget — a motivational overlay, not a planning tool
- Track progress: spent vs target, remaining amount, days left

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

## Internationalization

- **Locales:** `da` (Danish, default), `en` (English) — no locale URL segments
- **Locale resolution:** user `locale` field (synced to cookie on sign-in) → cookie → Accept-Language → default `da`
- **User locale field:** stored in the user record, synced to cookie on sign-in, used for emails and server-side contexts
- **All user-facing text must use translation keys** — never hardcode strings in components
- **Danish first:** when adding new keys, always add `da` translation first, then `en`
- **Message files:** `messages/da.json`, `messages/en.json` — organized by namespace
- **Server Components:** `useTranslations('namespace')`
- **Client Components:** `useTranslations('namespace')` hook
- **Config:** `src/i18n/config.ts` (locales), `src/i18n/request.ts` (locale resolution)

## Key Conventions

- All significant architectural decisions must be documented as an ADR in `docs/adr/` before implementation
- Tests are co-located with source files using `.test.ts` or `.spec.ts` suffixes
- Environment variables must be added to `.env.example` and validated in `src/env.js`
- Never commit `.env`
- All user-facing strings must use translation keys via `useTranslations()` — never hardcode text
- When adding new UI, always add both `da` and `en` translations in `messages/`
- Keep family scoping and permissions explicit in all data access
- Separate domain logic from UI where practical
- Prefer simple, clear solutions over over-engineering
- All financial data is manually entered or CSV-imported (no bank integrations in MVP)

## Database Migrations

Drizzle migrations live in `drizzle/` and are tracked via `drizzle/meta/`.

- **Development (always do both, in this order):**
  1. `npm run db:generate` — emits the migration SQL file from schema changes. The file **must** be committed so production can apply it.
  2. `npm run db:push` — pushes the schema to the local dev DB directly. Faster than running migrations and fine for local iteration.
- **Production:** Coolify runs `npm run db:migrate` automatically after each deploy. Never run `db:push` against production — it bypasses migration tracking.
- **Never edit generated migration files** once they've shipped; create a new migration instead.

## Design System

- Fonts: DM Serif Display (headings) + DM Sans (body) — `font-display` / `font-sans`
- Primary: warm gold (`hsl(38 60% 50%)`) — dark sidebar with gold accent
- Finance colors: `income` (green), `expense` (red), `debt` (orange), `savings` (blue), `warning` (amber)
- Shadows: `shadow-card`, `shadow-elevated`
- Components: shadcn/ui in `src/components/ui/` — add more via `npx shadcn@latest add <component>`
- Source of truth: Lovable prototype export + `src/styles/globals.css`

## Folder Structure

Frontend code lives inside `src/app/` using `_` prefixed directories to avoid route generation:

- `src/app/_components/` — shadcn/ui components and app components
- `src/app/_lib/` — client-side utilities (auth client, cn helper)
- `src/app/_hooks/` — React hooks
- `src/app/_styles/` — global CSS and design system tokens
- `src/app/` — Next.js App Router pages and layouts

Server code lives outside `src/app/`:

- `src/server/db/` — Drizzle schema and database client
- `src/server/api/` — tRPC routers and procedures
- `src/server/better-auth/` — BetterAuth server configuration
- `docs/adr/` — Architecture Decision Records

## ADR Index

- `0001` — Use T3 Stack
- `0002` — Use Sentry for error monitoring (superseded by 0013)
- `0003` — Use Drizzle ORM
- `0004` — Use BetterAuth
- `0005` — Email OTP-only authentication
- `0006` — Family-scoped multi-tenancy
- `0007` — Manual-first financial data entry
- `0008` — Annual budget with gamified challenges
- `0009` — Use shadcn/ui as component library
- `0010` — Aurum design system from Lovable prototype
- `0011` — Use next-intl for internationalization
- `0012` — All user-facing text must use translation keys
- `0013` — Use PostHog for product analytics and error monitoring
- `0014` — Projects as a transaction dimension
- `0015` — In-app announcements as bundled content
- `0016` — Family-level Stripe subscriptions (Stripe Customer = Family)
- `0017` — Custom Stripe SDK integration over BetterAuth Stripe plugin
- `0018` — 7-day grace period and downgrade policy for failed payments
- `0019` — Centralized plan-entitlements module (`src/server/billing/plans.ts`)
- `0020` — Stripe Price IDs configured via environment variables
- `0022` — Discount codes at checkout (Stripe promotion codes)
- `0023` — Terms & Conditions acceptance with versioned snapshots

## Testing

- Test runner: Vitest
- Tests live alongside source files (e.g. `foo.ts` → `foo.test.ts`)
- Run tests: `npm test`
- Run with coverage: `npm run test:coverage`

## MVP Scope Boundaries

**In scope:** email OTP auth, family collaboration, account-based transactions, annual budgets with monthly breakdown, spending challenges, debt/asset tracking, net worth, income planner, CSV import, manual data entry

**Out of scope for MVP:** automatic bank integrations (PSD2/Open Banking), real money transfers, bill payment, advanced forecasting, AI insights, tax reporting, native mobile app, complex permissions beyond owner/member

## What AI Should Never Do

- Configure or modify the production deployment pipeline
- Commit or expose secrets or credentials
- Create ADRs with status "Accepted" without explicit human confirmation
- Introduce bank integration or PSD2 features
- Add authentication methods beyond email OTP
