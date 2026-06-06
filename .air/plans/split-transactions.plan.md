# Split Transactions

## Context

Bank transactions often bundle multiple categories into one line — car finance + insurance, or school + lunch + after-school. One categorized transaction can't represent that, so spending lands in the wrong category. This feature lets a user split one transaction into ≥2 parts, each with its own category (expense **and** income).

User decisions: parts shown in list, original hidden but inspectable for bank reconciliation; re-import must not recreate the original; parts must sum exactly to the total; full in-place edit of parts plus unsplit; standard tRPC + Drizzle (no local-first).

## Approach

The **original transaction stays the bank source of truth**: keeps its `externalId`, `amount`, and account-balance contribution, but is flipped to `excludedFromCalculations=true` so budgets/challenges/projects/account-spend stats ignore it (those queries already filter `excludedFromCalculations=false`).

**Child parts** are new rows linked via a new self-FK `splitParentId`. They carry the real categories, sum exactly to the original, are counted in calcs (`excludedFromCalculations=false`), have `externalId=NULL`, and — critically — **do NOT call `applyBalanceDelta`** (balance is owned by the original). Result: balance + net worth unchanged by a split; budgets see the parts; the `(accountId, externalId)` unique index + `onConflictDoNothing` skips the original on re-import and never touches the parts.

Display lists hide split originals via a `NOT EXISTS` anti-join on `splitParentId`; calc queries need no change. Keeping balance on the original means split/unsplit/edit never recompute balance or rounding — eliminating reconciliation bugs.

## Schema (`src/server/db/schema/transaction.ts`)
- Add nullable self-FK `splitParentId` → `transaction.id`, `onDelete: cascade`.
- Add partial index `transaction_split_parent_idx` on `splitParentId WHERE NOT NULL`.
- Add `splitParent`/`splitParts` relations.
- Migration: `npm run db:generate` (commit SQL) then `npm run db:push` to dev; never push prod.

## Server (`src/server/api/routers/transaction.ts`, all in `ctx.db.transaction`)
Shared validation of a splittable original: family-scoped; `splitParentId` null; not a transfer; not already split; ≥2 parts; `sum(parts)===original.amount`; parts inherit `type`/`accountId`/`date`; `categoryId` optional, leaf if present.
- **`split`** `{ transactionId, parts:[{amount,categoryId?,projectId?,note?}] }` — insert parts (no balance delta, no rounding) → set original `excludedFromCalculations=true` → refresh challenge snapshots. Do **not** `learnFromCategorization` for parts (avoids merchant→category rule pollution).
- **`updateSplit`** — re-validate sum, replace parts, no balance recompute.
- **`unsplit`** — delete parts, restore original `excludedFromCalculations=false`.
- **`getSplit`** — return original (date, description, amount, account, `externalId` bank ref) + sibling parts for the inspect view.
- **`list`** (~314) and account display list: add `notExists(child where split_parent_id = transaction.id)` to hide split originals. Calc queries (`budget.ts:152`, `project.ts`, `challenge-service.ts`, `financial-account.ts` stats) unchanged.
- **`delete`** (~999): on an original with parts, FK cascade removes parts but refresh challenge snapshots for parts' dates + invalidate explicitly; original balance rollback unchanged.

## Frontend (`src/app/(protected)/transactions/`)
- New `_components/transaction-split-dialog.tsx` — responsive Dialog/Drawer like `transaction-category-dialog.tsx` (`useIsMobile()`). Dynamic part rows (amount + `CategorySelect` + optional note/project); live **remaining** indicator gating save at `0 kr.`; prefills + add/remove/adjust for existing splits (full edit) plus **Unsplit**. Invalidates `transaction.list`, `financialAccount.*`, `challenge.*`, `budget.*`.
- `page.tsx` rows (desktop ~504-681, mobile ~687-853): split icon on part rows mirroring the `transferGroupId` `Link2` pattern (~534-538/~716-720) → inspect-original view; dropdown gains "Split transaction" / "Edit split" / "Inspect original" / "Unsplit". Reuse `formatAmount` (`page.tsx:75`).

## i18n
Add `transactions`-namespace keys, **`messages/da.json` first then `en.json`**: `splitTransaction`, `splitDescription`, `part`, `addPart`, `removePart`, `remaining`, `mustSumToTotal`, `inspectOriginal`, `originalTransaction`, `bankReference`, `editSplit`, `unsplit`, `splitInto`. Reuse `linkedTransaction`.

## ADR + T&C
- Add `docs/adr/0024-split-transactions.md`, status **Proposed** (not Accepted without human sign-off), per precedent `0014`; add to `CLAUDE.md` ADR index.
- Check `src/server/terms` (mirrored in `AGENTS.md`) per the T&C-on-feature-change rule; note outcome.

## Acceptance criteria
- Splitting 1.000 kr. into 600+400 leaves account balance and net worth unchanged.
- Parts appear with their categories; original no longer in the list.
- Budget actuals count 600+400 by category, not the original.
- Re-importing the original row → `inserted:0, skipped:1`; no part recreated.
- Save blocked unless parts sum exactly (remaining=0).
- Editing a split re-validates sum, replaces parts, no balance change.
- Unsplit restores the original to the list and to calcs.
- Cannot split a transfer, a part, or an already-split transaction.
- Inspecting a part shows the original's bank ref, full amount, date, account.
- No hardcoded strings; `da`+`en` present.

## Verification
- `npm test` — new `transaction.split.test.ts`: sum validation, balance invariant, re-import dedup, budget attribution, unsplit restore, full-edit replace, cannot-split guards.
- Manual: create/import a transaction, split, verify list/budget/balance, re-run CSV import to confirm dedup, then edit + unsplit.

## Risks & mitigations
- Double-counting → original `excludedFromCalculations=true`; calc queries already filter it (budget test).
- Balance drift → parts never move balance; no recompute path.
- Re-import recreating parts → parts have no `externalId`, outside the dedup index (dedup test).
- Rule pollution → parts skip `learnFromCategorization`.
- List perf → anti-join backed by new partial index.