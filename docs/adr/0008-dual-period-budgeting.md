# ADR-0008: Annual Budget with Gamified Challenges

## Status

Accepted

## Date

2026-04-17 (amended from 2026-04-12)

## Amendments

- **2026-04-17:** Expanded the Challenges section to cover three challenge types (spend-less, savings, pay-off-loan) and one-off vs repeating durations with per-period instance history. The original formulation covered only spend-less weekly/monthly challenges.

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

### 2. Challenges

A **Challenge** is a time-boxed goal that layers on top of the annual budget as a gamification mechanic. Challenges come in three **types**, each with the same structural shell but a different progress metric:

- **Spend-less** — "keep spending in category X below Y during the period." Progress = sum of expense transactions in the chosen category during the period. On-track when `progress ≤ target`.
- **Savings** — "grow account X's balance by Y during the period." Progress = net balance change on the chosen account during the period (income and inbound transfers add; expenses and outbound transfers subtract). On-track when `progress ≥ target`.
- **Pay-off-loan** — "pay Y extra towards a loan during the period." Progress = sum of expense transactions in the linked "loan payment" category during the period. A specific Debt can optionally be linked for context. On-track when `progress ≥ target`.

#### Duration

Every challenge is either **one-off** or **repeating**:

- **One-off** — fixed `startDate` + `endDate`.
- **Repeating** — `startDate` + repetition (`weekly`, `monthly`, `yearly`, or `custom N days`). Periods are anchored to `startDate` (not calendar boundaries), so a monthly challenge starting on the 15th runs the 15th → 14th each month.

#### Per-period instances

To preserve history for repeating challenges, each period is represented by a **ChallengeInstance** row (`periodStart`, `periodEnd`, `status`, `finalAmount`). Instances are created lazily on view: when a user opens the challenges list, any repeating challenge whose latest instance has ended is closed (status set to `completed` or `failed` based on target comparison, `finalAmount` snapshotted) and the next instance is spawned. One-off challenges always have exactly one instance.

#### UI

Each challenge card shows: the current period's progress vs target, remaining amount (or over-by for spend-less), days left, and an on-track vs off-track indicator computed from pace. Detail view (future) surfaces historical instances.

#### Examples

- Spend-less, weekly: "Groceries under 1.500 kr. each week"
- Spend-less, one-off: "No dining out for the next 2 weeks"
- Savings, monthly: "Save 5.000 kr. to the holiday account each month"
- Pay-off-loan, yearly: "Pay 20.000 kr. extra on the car loan this year"

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
