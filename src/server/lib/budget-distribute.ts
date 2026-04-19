export type BudgetRecurrence =
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "annual"
  | "custom";

const EMPTY: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

// Number of periods per year for each recurrence. Custom returns 1 (the caller
// fills cells manually).
export function periodsPerYear(recurrence: BudgetRecurrence): number {
  switch (recurrence) {
    case "monthly":
      return 12;
    case "quarterly":
      return 4;
    case "semi_annual":
      return 2;
    case "annual":
      return 1;
    case "custom":
      return 1;
  }
}

// Default start-month for each recurrence, chosen so the canonical calendar
// layout lands on Dec / Jun-Dec / Mar-Jun-Sep-Dec. Used when the caller
// doesn't specify a start month.
export function defaultStartMonth(recurrence: BudgetRecurrence): number {
  switch (recurrence) {
    case "monthly":
      return 0;
    case "quarterly":
      return 2;
    case "semi_annual":
      return 5;
    case "annual":
      return 11;
    case "custom":
      return 0;
  }
}

function slotIndices(
  recurrence: BudgetRecurrence,
  startMonth: number,
): number[] {
  const start = ((startMonth % 12) + 12) % 12;
  switch (recurrence) {
    case "monthly":
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    case "quarterly":
      return [0, 3, 6, 9].map((offset) => (start + offset) % 12).sort((a, b) => a - b);
    case "semi_annual":
      return [0, 6].map((offset) => (start + offset) % 12).sort((a, b) => a - b);
    case "annual":
      return [start];
    case "custom":
      return [];
  }
}

function buildFromSlots(periodAmount: number, slots: number[]): number[] {
  const amounts = [...EMPTY];
  if (slots.length === 0 || periodAmount <= 0) return amounts;
  for (const idx of slots) amounts[idx] = periodAmount;
  return amounts;
}

// Distribute a per-period amount (integer cents/øre) across 12 months.
// The per-period amount is applied to each active slot; for monthly that's
// every month, for quarterly four of them, etc.
export function distributeByPeriod(
  periodAmount: number,
  recurrence: BudgetRecurrence,
  startMonth?: number | null,
): number[] {
  const start = startMonth ?? defaultStartMonth(recurrence);
  return buildFromSlots(periodAmount, slotIndices(recurrence, start));
}

// Backwards-compatible helper: distribute an *annual* amount across 12 months.
// Divides by periodsPerYear, pushes any remainder to the last active slot so
// the sum equals `annual` exactly.
export function distributeAmount(
  annual: number,
  recurrence: BudgetRecurrence,
  startMonth?: number | null,
): number[] {
  const amounts = [...EMPTY];
  if (recurrence === "custom" || annual <= 0) return amounts;

  const start = startMonth ?? defaultStartMonth(recurrence);
  const slots = slotIndices(recurrence, start);
  if (slots.length === 0) return amounts;

  const base = Math.floor(annual / slots.length);
  const remainder = annual - base * slots.length;
  for (const idx of slots) amounts[idx] = base;
  const lastIdx = slots[slots.length - 1]!;
  amounts[lastIdx] = (amounts[lastIdx] ?? 0) + remainder;
  return amounts;
}
