# ADR-0024: Split Transactions

## Status

Proposed

## Date

2026-06-06

## Context

Bank transactions often bundle multiple categories into a single line — a car
finance payment combined with insurance, or a school invoice covering tuition,
lunch, and after-school care. A single categorized transaction cannot represent
that, so the whole amount lands in one (wrong) category and budgets, challenges,
and project rollups are distorted.

Users need to split one transaction into two or more parts, each with its own
category (for both expense and income). The hard constraints surfaced during
design:

- **Bank reconciliation must survive.** The original bank row (its `externalId`,
  amount, and date) has to remain inspectable so a user can tie the split back
  to a statement, and a re-import of the same CSV must **not** recreate the
  original or duplicate the parts.
- **The account balance and net worth must not move** when a transaction is
  split, edited, or unsplit. Splitting is a re-classification, not a new flow of
  money.
- **The parts must sum exactly to the original** — no rounding remainder.
- Parts are shown in the transaction list; the original is hidden but
  inspectable. Splits are fully editable (add/remove/adjust parts) and
  reversible (unsplit).

## Decision

### The original stays the source of truth

Rather than zeroing the original or deleting it, the **original transaction is
kept** and flipped to `excludedFromCalculations = true`. It retains its
`externalId`, `amount`, and account-balance contribution. Every calculation
query (budget actuals `budget.ts`, project rollups `project.ts`, challenge
snapshots `challenge-service.ts`, and account stats `financial-account.ts`)
already filters `excludedFromCalculations = false`, so they ignore the original
with **no query changes**.

### Child parts

Parts are new `transaction` rows linked to the original via a new nullable
self-FK `splitParentId` (`ON DELETE CASCADE`). They:

- carry the real categories (and optional project/note),
- inherit `type`, `accountId`, `date`, and `description` from the original,
- sum exactly to the original amount,
- have `excludedFromCalculations = false` (so they are counted),
- have `externalId = NULL`, and
- **never call `applyBalanceDelta`** — the balance is owned by the original.

The net effect of a split on account balance and net worth is therefore exactly
zero, and there is no rounding or recompute path to drift.

### Re-import safety

The dedup index is `uniqueIndex(accountId, externalId) WHERE externalId IS NOT
NULL` with `onConflictDoNothing`. The original keeps its `externalId`, so a
re-import skips it (`inserted: 0, skipped: 1`). The parts have `externalId =
NULL`, so they fall outside the index entirely and are never touched.

### Display

The transaction list (`transaction.list`, also used by the account detail page)
hides split originals with a `NOT EXISTS` anti-join on `splitParentId`, backed by
a new partial index `transaction_split_parent_idx`. Calc queries need no change
because they filter on `excludedFromCalculations`.

### Server surface (`transaction.ts`, all in `ctx.db.transaction`)

- `split({ transactionId, parts[] })` — insert parts (no balance delta), flip
  original to excluded, refresh challenge snapshots. Parts deliberately do **not**
  call `learnFromCategorization` to avoid polluting merchant→category rules.
- `updateSplit` — re-validate the sum, replace all parts, no balance recompute.
- `unsplit` — delete parts, restore the original to calculations and the list.
- `getSplit` — resolve the original (date, description, amount, account,
  `externalId`) plus sibling parts for the inspect view; accepts either the
  original's id or a part's id.

Sum/part validation lives in a pure, unit-tested helper
(`src/server/lib/split-helpers.ts`).

Deleting an original with parts cascades the parts away via the FK; the balance
rollback uses the original's amount (unchanged). Deleting a *part* directly
skips the balance rollback and rounding rollback, because parts never moved the
balance.

### Modeling alternatives considered

1. **Zero the original and attach parts** — loses the bank amount, breaks
   reconciliation and re-import dedup.
2. **Delete the original, parts carry `externalId`** — re-import would recreate
   the parts (and the dedup target collides across multiple parts sharing one
   `externalId`).
3. **A separate `transaction_split` table** — more schema and join surface for
   no gain; parts are ordinary transactions in every other respect (they appear
   in lists, carry categories/projects, count in calcs).

Option in this ADR (keep original, exclude it, link parts via self-FK) was
selected: minimal schema, zero changes to calc queries, and the balance/dedup
invariants fall out for free.

## Consequences

- **Positive:** Balance and net worth are invariant under split/edit/unsplit by
  construction — no recompute, no rounding.
- **Positive:** Re-import is safe with no new dedup logic.
- **Positive:** Calc queries are untouched; only display gains an anti-join.
- **Trade-off:** Parts are real transaction rows, so a user could delete a
  single part from the list and leave the parts not summing to the original.
  The server keeps the balance correct in that case (parts never owned balance),
  and the intended flows (edit split / unsplit) are surfaced in the row menu.
- **Trade-off:** The self-FK adds a fifth FK to `transaction`; the partial index
  keeps the anti-join cheap.
- **Follow-up:** Parts inherit the original's `description`; a future iteration
  could let each part carry its own label.

## Terms & Conditions

Reviewed per the T&C-on-feature-change rule. Splitting is an internal
re-classification of manually-entered/imported data — it moves no money,
introduces no new data sharing, and adds no external processor. It is already
covered by the existing terms (§2 "manually track … transactions" and §3 "you
are responsible for the accuracy of the data you enter"). **No T&C change
required.**
