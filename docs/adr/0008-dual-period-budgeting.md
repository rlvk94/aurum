# ADR-0008: Dual-Period Budgeting Model

## Status

Proposed

## Date

2026-04-12

## Context

Aurum's users need budgeting at two different time scales:

- **Weekly budgets** for short-term spending control — groceries, dining out, transport, entertainment. These categories are checked frequently (multiple times per week) to stay on track.
- **Monthly budgets** for broader financial planning — housing, utilities, subscriptions, savings contributions. These are reviewed once a month.

Many budgeting apps support only one period type, forcing users to either plan everything monthly (losing short-term visibility) or everything weekly (making long-term categories awkward). The current spreadsheet-based workflow already uses both periods, and the app should preserve this.

## Decision

Support both **weekly** and **monthly** budget periods using a **single unified model**.

### Model structure

- A **Budget** record has a `period_type` field (`week` or `month`), along with `period_start` and `period_end` dates.
- A **BudgetLine** belongs to a Budget and maps a category to a `planned_amount`.
- Budget vs actual is calculated by summing categorized expense transactions within the budget's date range, scoped to the family.

### Key behaviors

- Weekly and monthly budgets are independent — they can have different categories and different planned amounts.
- A category can appear in both a weekly and a monthly budget (e.g. "Groceries" might have a weekly target of 1.500 kr. and a monthly target of 5.500 kr.).
- Transfer transactions are excluded from budget actuals.
- The UI shows budget vs actual with remaining amounts and overspending indicators.
- Copying a previous budget to create a new one should be supported if straightforward.

## Consequences

- **Positive:** Matches the user's existing mental model — weekly for tactical control, monthly for strategic planning.
- **Positive:** Unified model keeps the schema and business logic simple — no separate tables or code paths for weekly vs monthly.
- **Positive:** Flexible date ranges mean the model can support custom periods in the future if needed.
- **Trade-off:** Budget vs actual queries need to filter transactions by date range, which requires indexed date columns and clear family + date scoping.
- **Trade-off:** Users may have overlapping budgets for the same category at different periods — the UI must make it clear which budget they're viewing.
- **Follow-up:** The dashboard should surface both "this week" and "this month" budget summaries prominently.
