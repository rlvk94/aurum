# ADR-0014: Projects as a Transaction Dimension

## Status

Accepted

## Date

2026-04-25

## Context

Aurum lets families track spending by category and account, but there is no first-class way to roll spend up across categories for a single endeavor. A user planning a vacation buys flights, groceries, restaurants, attractions, and souvenirs across many categories and possibly several accounts; today they have to filter by date range and a hand-picked list of categories to estimate the total. The same problem applies to home renovations, weddings, sabbaticals, and any other multi-month, multi-category undertaking.

Three modeling options were considered:

1. **A synthetic category** — encode the project as a category. Rejected: the user already classifies a flight as "Travel" and a restaurant on the trip as "Dining"; folding them into a single "Italy 2026" category destroys the existing categorization. Categories also have a parent/child shape that does not match how projects start, end, or get archived.
2. **A many-to-many tag system** — let a transaction belong to any number of projects via a join table. Adds UX and accounting complexity (double-counting in totals, aggregation rules) without a clear MVP win — most real expenses belong to one endeavor at a time.
3. **A nullable foreign key on `transaction`** — a transaction has at most one project. Selected. Mirrors how `categoryId` is modeled today, fits the dominant use case, and keeps aggregation queries straightforward.

A separate question is whether income transactions should also count toward a project. Some real situations argue yes (a vacation gift, a renovation rebate, a wedding contribution from family). Treating them as part of the project — and surfacing the **net** alongside the gross spend — gives the user the truthful picture without making expense-only the only mental model.

## Decision

### Schema

A new `project` table, family-scoped (`src/server/db/schema/project.ts`):

```
project {
  id: uuid PK (defaultRandom)
  familyId: uuid → family.id (ON DELETE CASCADE)
  name: text NOT NULL                             // 1..100
  description: text                               // optional, ≤1000
  emoji: text NOT NULL DEFAULT '📌'              // 1..8 chars (covers ZWJ + variation selectors)
  coverPalette: text NOT NULL DEFAULT 'gold'      // one of 8 keys; see below
  spendingLimit: integer                          // cents, nullable
  startDate: date                                 // nullable
  endDate: date                                   // nullable
  archivedAt: timestamptz                         // soft archive
  createdAt: timestamptz NOT NULL
  updatedAt: timestamptz NOT NULL
}
INDEX project_family_idx (family_id, archived_at)
```

Both date fields are optional so projects can also act as open-ended trackers; populating both unlocks the on-track indicator on the detail page. `archivedAt` is the same soft-archive pattern Challenges and Debts use elsewhere — reads filter on it; UI lets the owner unarchive.

The `transaction` table gains:

- `projectId: uuid` FK → `project.id`, **`ON DELETE SET NULL`**, nullable.
- A partial index `transaction_project_idx (project_id) WHERE project_id IS NOT NULL` so project rollups stay cheap as the transaction table grows.
- A `project` relation in the Drizzle relations file.

Deletion semantics: deleting a project removes only the link — the underlying transactions keep their categories, accounts, amounts, and notes. Archiving (`setArchived`) is the soft alternative for projects the user wants to retain in history.

### Cover palette

Cover palette is stored as a single key (not a hex value), one of: `gold`, `sand`, `sage`, `ocean`, `sky`, `plum`, `clay`, `slate`. The eight curated palettes are defined in CSS via `[data-project-palette="<key>"]` rules in `globals.css` and used by `<ProjectCover>`. This keeps palette tweaks (light/dark, contrast) in CSS rather than in the database. The list of valid keys is exported from the project router as `PROJECT_PALETTES` and validated server-side on create/update.

### Aggregation

Project totals are computed per-request from `transaction` rows whose `projectId` matches and whose account is accessible to the viewing user (account-visibility scoping is preserved across the existing shared/private model). Both expense and income transactions are included; the project surfaces three primary numbers:

- **Spent** — sum of expense amounts.
- **Received** — sum of income amounts.
- **Net** — `spent − received`. This is the number compared against `spendingLimit` and used for the on-track indicator.

The list endpoint also returns `topCategoryIds` (top 5 by expense per project) for the card chips. The detail endpoint additionally returns full `byCategory` and `byAccount` breakdowns and the 30 most recent linked transactions.

Status (`not_started`, `active`, `ended`, `met`, `over`, `no_dates`, plus the UI-only `archived`) is derived in the UI from the persisted fields (`startDate`, `endDate`, `spendingLimit`, `net`, `archivedAt`) — the server stores raw data, the UI computes display state.

### tRPC procedures (`src/server/api/routers/project.ts`)

All `protectedProcedure`. Family scoping via `getActiveFamilyId` and the existing account-visibility helpers, mirroring the conventions in `transaction.ts` and `challenge.ts`.

- `list({ includeArchived?: boolean })` — projects for the active family, sorted by name. Each row decorated with `spent`, `received`, `net`, `transactionCount`, `topCategoryIds[]`.
- `get({ id })` — full project + `byCategory[]` + `byAccount[]` + 30 most recent linked transactions.
- `create(input)` — Zod validates: name 1..100, emoji 1..8, palette ∈ enum, spendingLimit positive integer or null, `endDate ≥ startDate` when both set.
- `update({ id, ...partial })` — partial update of any base field; same validation.
- `setArchived({ id, archived })` — toggles `archivedAt`.
- `delete({ id })` — hard delete; transactions get `projectId = NULL` via the FK.
- `assignTransactions({ projectId | null, transactionIds[] })` — bulk re-assign up to 500 transactions; each transaction is filtered to the active family and accounts the user can access before update.

The `transaction` router was extended in two places to keep the seam minimal:
- `transaction.list` accepts an optional `projectId` filter (`null` = unassigned, `undefined` = no filter).
- `transaction.create` and `transaction.update` accept an optional `projectId`.

### UI

- **Sidebar** — Projects entry under the Finance group, between Accounts and Budgets. Icon `FolderHeart`. Shortcut `G P`. Registered in `_lib/navigation.ts` so breadcrumbs and the command palette pick it up.
- **List page** (`/projects`) — pill-segmented filter (All / Active / Ended), card grid, archived collapsed section. Empty state is a hero with three pre-fill suggestion chips (Vacation 🏖️, Renovation 🛠️, Wedding 💐) that open the form dialog with that name + emoji + palette pre-selected.
- **Detail page** (`/projects/[projectId]`) — full-bleed hero (palette + emoji + name + period + status pill), KPI strip (Spent / Received / Net / Remaining or "Over by"), a custom **burndown lane** with start/end date axis, a Today caption above an elapsed-time tick, and an on-track / off-track tag. Two-column category and account breakdowns, then a 30-row recent transactions table with a "see all" link to the transactions page filtered by this project.
- **Form dialog** — live cover preview at the top (palette + emoji + name), curated emoji grid plus manual override, palette swatch picker, spending limit, optional start/end dates with clear buttons.
- **Transactions integration** — Project filter dropdown on the transactions page (with `?project=<id|unassigned>` URL binding for shareable views), Project column with palette pill in the row, quick-assign dialog from the row dropdown menu, and a Project field in the transaction form dialog.

### Relationship to Challenges

Challenges (ADR 0008) and Projects look superficially similar — both have time bounds and a target — but they answer different questions:

- A Challenge is an abstract behavior goal: "spend less than X on groceries this week." It is anchored to categories or accounts, can repeat, and has per-period instances.
- A Project is a concrete endeavor: "the Italy 2026 vacation." It is anchored to a slice of transactions, never repeats, and has no per-period history. The same transaction can simultaneously contribute to a Challenge (because it falls in a tracked category) and a Project (because the user tagged it).

## Consequences

- **Positive:** A single column on `transaction` keeps queries simple and joins cheap. The partial index makes the common rollup query (`SELECT type, SUM(amount) FROM transaction WHERE project_id = ?`) index-only.
- **Positive:** `ON DELETE SET NULL` makes deleting a project safe — no risk of cascading away the user's transaction history.
- **Positive:** Allowing income enables true net tracking (rebates, gifts, refunds) without forcing a workaround.
- **Positive:** Storing the palette as a key (not hex) keeps light/dark tweaks centralized in CSS.
- **Trade-off:** A transaction belongs to at most one project. Splitting a single grocery bill between "groceries" and "the renovation kitchen restock" requires the user to either pick one or split the transaction. This is acceptable for MVP and can be revisited if real users hit the wall.
- **Trade-off:** Projects do not affect the annual budget or budget-vs-actual calculations. Projects are a parallel rollup, not a planning tool — same separation we already enforce between Budgets and Challenges.
- **Trade-off:** Status is derived in the UI rather than stored. Cheaper to evolve, but if the server ever needs to filter by status (e.g. "show me everyone's active projects"), the helper will need to move server-side or be reconstructed there.
- **Follow-up:** Multi-row assignment from the transactions list (checkbox-based bulk action) is supported by `assignTransactions` but not yet wired in the UI; the per-row quick-assign covers the common case.
