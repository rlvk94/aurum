# ADR-0007: Manual-First Financial Data Entry

## Status

Accepted

## Date

2026-04-12

## Context

Modern finance apps often rely on automatic bank integrations (PSD2, Open Banking, Plaid) to import transactions. While this reduces manual effort, it introduces significant complexity:

- Regulatory requirements (PSD2 compliance, data processing agreements)
- Third-party service dependencies and costs
- Bank-specific edge cases and data quality issues
- Security and privacy concerns around sharing bank credentials
- Ongoing maintenance of integration adapters

Aurum's MVP goal is a reliable, user-friendly core experience that replaces a spreadsheet and a simple spend-tracking app. The target users are comfortable with manual data entry — they already do it in spreadsheets.

## Decision

All financial data in the MVP is **entered manually or imported via CSV**. No automatic bank integrations.

### Data entry methods

1. **Manual transaction entry** — users create individual transactions through the UI.
2. **CSV import** — users export transactions from their bank's online portal and import them into Aurum. The import flow handles column mapping, duplicate detection, and categorization.

### Categorization support

- Family-scoped **categorization rules** (keyword → category mappings) are applied automatically during CSV import to reduce manual effort.
- An **uncategorized review flow** helps users quickly categorize imported transactions that didn't match any rule.

## Consequences

- **Positive:** No third-party dependencies for core functionality — the app works entirely self-contained.
- **Positive:** No regulatory complexity — no PSD2 compliance, no data processing agreements with banks.
- **Positive:** Simpler, more predictable data model — all transactions come from known input paths.
- **Positive:** CSV import covers the highest-friction use case (bulk transaction entry) while staying simple.
- **Trade-off:** Users must manually export CSV files from their banks and import them. This is a weekly task, not continuous.
- **Trade-off:** Account balances must be maintained by the app based on transactions + opening balance, or updated manually. No real-time sync.
- **Follow-up:** The CSV import flow needs to be robust and user-friendly since it's the primary bulk-entry mechanism. Column mapping, date format handling, and duplicate detection are important.
