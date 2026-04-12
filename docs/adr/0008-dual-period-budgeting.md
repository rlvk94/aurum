# ADR-0008: Annual Budget with Spending Challenges

## Status

Accepted

## Date

2026-04-12

## Context

Aurum needs a budgeting model that reflects how household finances actually work: expenses are planned for a full year, but not every expense occurs every month. Some are monthly (rent, subscriptions), others are quarterly (insurance), semi-annual, or annual (car tax, holiday spending). A budgeting model locked to fixed week or month periods cannot represent this naturally.

At the same time, users want short-term tactical control — the ability to set a time-boxed spending goal like "spend less than 2.000 kr. on groceries this week" or "keep dining out under 1.500 kr. for the next two weeks." These are not budgets in the planning sense — they are **challenges**: focused, motivational, and temporary.

The previous proposal (ADR 0008, dual-period weekly/monthly) treated these as the same concept. In practice they serve different purposes and should be modeled separately.

## Decision

### 1. Annual Budget

The primary budget is an **annual plan** for a family, broken down into 12 monthly columns.

- A **Budget** represents a single year for a family (e.g. "2026 Budget").
- A **BudgetLine** maps a category to a planned amount and a **recurrence** pattern that determines how the amount is distributed across months.

Supported recurrence types:

- `monthly` — same amount every month (e.g. rent: 9.500 kr./month)
- `quarterly` — amount applied to specific quarter months (e.g. insurance: 3.600 kr. in Jan, Apr, Jul, Oct)
- `semi_annual` — amount applied twice a year
- `annual` — amount applied to a single month
- `custom` — user specifies per-month amounts directly

Each budget line produces a **planned amount per month**, enabling a 12-month overview. Budget vs actual for a given month is calculated by summing categorized expense transactions in that month against the planned amounts.

### 2. Spending Challenges

A **Challenge** is a separate, time-boxed spending goal with a flexible duration.

- A challenge has a **start date**, **end date**, **category** (or set of categories), and a **target amount**.
- Duration is flexible: 1 week, 2 weeks, 1 month, or any custom range.
- Challenges are independent of the annual budget — they layer on top as short-term motivational tools.
- The UI shows progress (spent vs target, remaining amount, days left) and whether the challenge is on track.

Examples:

- "Groceries challenge: stay under 1.500 kr. this week"
- "No dining out for 2 weeks"
- "Keep shopping under 3.000 kr. this month"

### Key behaviors

- The annual budget is the single source of truth for financial planning. The dashboard shows the current month's budget vs actual.
- Transfer transactions are excluded from budget actuals.
- Challenges are optional and do not affect the budget calculation — they are a motivational overlay.
- Copying last year's budget to seed a new year should be supported.

## Consequences

- **Positive:** Annual budgets with recurrence patterns accurately model real household expenses — quarterly insurance, annual subscriptions, and monthly rent all fit naturally.
- **Positive:** The 12-month view gives users a full-year financial picture, making it easy to see months with higher planned spending.
- **Positive:** Challenges are decoupled from the budget model, keeping each concept simple and focused.
- **Positive:** Flexible challenge durations support any time-boxed goal without constraining the model to fixed periods.
- **Trade-off:** Recurrence logic adds complexity to budget line creation — the UI must make it easy to set up monthly vs quarterly vs custom patterns.
- **Trade-off:** Two related but distinct concepts (budgets and challenges) require clear UX separation so users understand the difference.
- **Follow-up:** The dashboard should show the current month's budget status prominently, with active challenges displayed alongside or below it.
