# Aurum

> A production-ready web application built with the T3 Stack.

## Project Overview

<!-- TODO: Fill in when the application's purpose is defined -->
Aurum is a full-stack TypeScript web application. This section will be updated with a detailed description of the application's purpose and features.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **API:** [tRPC](https://trpc.io/)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Auth:** [BetterAuth](https://www.better-auth.com/)
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
   git clone <repository-url>
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

## Further Documentation

- [T3 Stack Documentation](https://create.t3.gg/)
- [Next.js Documentation](https://nextjs.org/docs)
- [tRPC Documentation](https://trpc.io/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [BetterAuth Documentation](https://www.better-auth.com/docs)
- [Sentry Next.js Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
