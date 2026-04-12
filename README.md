# Aurum

> A multi-user family finance web application for shared household and personal financial management.

## Project Overview

Aurum combines account-based transaction tracking, weekly and monthly budgeting, debt tracking, asset tracking, net worth calculation, and income distribution planning — all within a shared family workspace.

It replaces a combination of a spend-tracking app and a custom finance spreadsheet, providing a single, cohesive tool for managing household finances.

### Core Features

- **Family workspaces** — shared financial data with owner/member roles
- **Account tracking** — checking, savings, cash, credit cards, e-wallets
- **Transactions** — manual entry and CSV import with categorization
- **Budgets** — weekly and monthly budget periods with budget vs actual tracking
- **Debts & Assets** — liability and asset tracking for full financial picture
- **Net Worth** — calculated from account balances + assets − debts
- **Income Planner** — templates for allocating income by percentage or fixed amount
- **Dashboard** — at-a-glance view of spending, budgets, balances, and net worth

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **API:** [tRPC](https://trpc.io/)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Auth:** [BetterAuth](https://www.better-auth.com/) (email OTP)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Language:** TypeScript (strict mode)
- **Error Monitoring:** [Sentry](https://sentry.io/)
- **Testing:** [Vitest](https://vitest.dev/)

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL (or use the provided `start-database.sh` script to run via Docker)

### Local Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/rlvk94/aurum.git
   cd aurum
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in the required values. See `.env.example` for descriptions of each variable.

4. **Start the database:**

   ```bash
   ./start-database.sh
   ```

5. **Run database migrations:**

   ```bash
   npm run db:migrate
   ```

6. **Start the development server:**

   ```bash
   npm run dev
   ```

   The app will be available at [http://localhost:3000](http://localhost:3000).

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the development server (with Turbopack) |
| `npm run build` | Build for production |
| `npm start` | Start the production server |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run Drizzle migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |

## Folder Structure

```
src/
├── app/                    # Next.js App Router pages and layouts
│   ├── api/
│   │   ├── auth/[...all]/  # BetterAuth API route handler
│   │   └── trpc/[trpc]/    # tRPC API route handler
│   └── _components/        # Page-level React components
├── lib/                    # Client-side utilities (auth client, etc.)
├── server/
│   ├── api/
│   │   └── routers/        # tRPC routers and procedures
│   ├── better-auth/        # BetterAuth server configuration
│   └── db/                 # Drizzle schema and database client
├── styles/                 # Global CSS
└── trpc/                   # tRPC client setup (React Query integration)

docs/
└── adr/                    # Architecture Decision Records

.github/
└── workflows/              # CI/CD workflows
```

## Testing

Tests are co-located with the source files they cover using the `.test.ts` suffix:

```
src/server/db/schema.ts        → src/server/db/schema.test.ts
src/server/api/routers/post.ts → src/server/api/routers/post.test.ts
src/lib/auth-client.ts         → src/lib/auth-client.test.ts
```

Run tests:

```bash
npm test                # Run all tests once
npm run test:watch      # Run in watch mode
npm run test:coverage   # Run with coverage (70% threshold enforced in CI)
```

## Architecture Decision Records (ADRs)

All significant architectural decisions are documented in [`docs/adr/`](docs/adr/).

To add a new ADR:

1. Create a new file in `docs/adr/` named `XXXX-short-title.md` (next sequential number).
2. Use the template from [`docs/adr/README.md`](docs/adr/README.md).
3. Set the status to **Proposed**.
4. Submit a pull request for review.
5. Update `CLAUDE.md` at the project root with the new ADR reference.

Current ADRs:

| # | Decision |
|---|----------|
| 0001 | [Use T3 Stack](docs/adr/0001-use-t3-stack.md) |
| 0002 | [Use Sentry for Error Monitoring](docs/adr/0002-use-sentry-for-error-monitoring.md) |
| 0003 | [Use Drizzle ORM](docs/adr/0003-use-drizzle-orm.md) |
| 0004 | [Use BetterAuth](docs/adr/0004-use-betterauth.md) |
| 0005 | [Email OTP-Only Authentication](docs/adr/0005-email-otp-only-auth.md) |
| 0006 | [Family-Scoped Multi-Tenancy](docs/adr/0006-family-scoped-multi-tenancy.md) |
| 0007 | [Manual-First Financial Data Entry](docs/adr/0007-manual-first-data-entry.md) |
| 0008 | [Dual-Period Budgeting Model](docs/adr/0008-dual-period-budgeting.md) |

## Further Documentation

- [T3 Stack Documentation](https://create.t3.gg/)
- [Next.js Documentation](https://nextjs.org/docs)
- [tRPC Documentation](https://trpc.io/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [BetterAuth Documentation](https://www.better-auth.com/docs)
- [Sentry Next.js Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
