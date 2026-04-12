# Architecture Decision Records (ADRs)

All significant architectural decisions for this project must be documented here as an ADR **before implementation**.

## Format

Each ADR is a Markdown file named `XXXX-short-title.md` using the following template:

```markdown
# ADR-XXXX: [Title]

## Status

[Proposed | Accepted | Deprecated | Superseded]

## Date

YYYY-MM-DD

## Context

[Why is this decision needed? What problem are we solving?]

## Decision

[What was decided?]

## Consequences

[What are the trade-offs, implications, or follow-up actions?]
```

## Process

1. Create a new ADR file with the next sequential number.
2. Set the status to **Proposed**.
3. Submit a pull request for team review.
4. Once approved, update the status to **Accepted**.
5. Update `CLAUDE.md` at the project root to reference the new ADR.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| 0001 | [Use T3 Stack](0001-use-t3-stack.md) | Accepted |
| 0002 | [Use Sentry for Error Monitoring](0002-use-sentry-for-error-monitoring.md) | Accepted |
| 0003 | [Use Drizzle ORM](0003-use-drizzle-orm.md) | Accepted |
| 0004 | [Use BetterAuth](0004-use-betterauth.md) | Accepted |
| 0005 | [Email OTP-Only Authentication](0005-email-otp-only-auth.md) | Proposed |
| 0006 | [Family-Scoped Multi-Tenancy](0006-family-scoped-multi-tenancy.md) | Proposed |
| 0007 | [Manual-First Financial Data Entry](0007-manual-first-data-entry.md) | Proposed |
| 0008 | [Dual-Period Budgeting Model](0008-dual-period-budgeting.md) | Proposed |
