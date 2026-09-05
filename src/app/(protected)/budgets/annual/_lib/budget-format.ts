export type CellState = "empty" | "under" | "near" | "at" | "warn" | "over";

const OVER_THRESHOLD = 0.1;

export function cellState(planned: number, actual: number): CellState {
  if (planned === 0 && actual === 0) return "empty";
  if (planned === 0) return actual > 0 ? "over" : "empty";
  const ratio = actual / planned;
  if (ratio <= 0.5) return "under";
  if (ratio <= 0.9) return "near";
  if (ratio <= 1) return "at";
  if (ratio <= 1 + OVER_THRESHOLD) return "warn";
  return "over";
}

export function fillClass(state: CellState): string {
  switch (state) {
    case "under":
      return "bg-primary/40";
    case "near":
      return "bg-primary/65";
    case "at":
      return "bg-primary";
    case "warn":
      return "bg-warning";
    case "over":
      return "bg-expense";
    case "empty":
    default:
      return "bg-primary/0";
  }
}

export function trackClass(state: CellState): string {
  switch (state) {
    case "over":
      return "bg-expense/15";
    case "warn":
      return "bg-warning/15";
    default:
      return "bg-muted";
  }
}

export function cellClass(state: CellState): string {
  switch (state) {
    case "at":
    case "near":
    case "under":
      return "bg-primary/5";
    case "warn":
      return "bg-warning/10";
    case "over":
      return "bg-expense/10";
    case "empty":
    default:
      return "";
  }
}

export function variancePillClass(planned: number, actual: number): string {
  if (planned === 0 && actual === 0) return "text-muted-foreground bg-muted";
  if (actual > planned) return "text-expense bg-expense/10";
  if (actual === planned) return "text-primary bg-primary/10";
  return "text-income bg-income/10";
}

export function varianceTextClass(planned: number, actual: number): string {
  if (planned === 0 && actual === 0) return "text-muted-foreground";
  if (actual > planned) return "text-expense";
  return "text-income";
}

export function varianceClass(planned: number, actual: number): string {
  return varianceTextClass(planned, actual);
}

export function parseMonthsShort(raw: string): string[] {
  const list = raw.split(",").map((s) => s.trim());
  if (list.length !== 12) {
    return [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
  }
  return list;
}

export function parseMonthsLong(raw: string): string[] {
  const list = raw.split(",").map((s) => s.trim());
  if (list.length !== 12) {
    return [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
  }
  return list;
}

// Given a budget year and current date, return per-month fractional expected
// elapsed progress. Months before "now" are 1; months after are 0; the current
// month is day-of-month / days-in-month.
export function expectedProgressFractions(year: number, now: Date): number[] {
  const thisYear = now.getFullYear();
  if (thisYear < year) return new Array<number>(12).fill(0);
  if (thisYear > year) return new Array<number>(12).fill(1);

  const month = now.getMonth();
  const fractions = new Array<number>(12).fill(0);
  for (let i = 0; i < 12; i++) {
    if (i < month) fractions[i] = 1;
    else if (i === month) {
      const daysInMonth = new Date(year, i + 1, 0).getDate();
      fractions[i] = now.getDate() / daysInMonth;
    }
  }
  return fractions;
}

export function sumArray(arr: number[]): number {
  return arr.reduce((acc, v) => acc + v, 0);
}

// ── Year-to-date status ──────────────────────────────────────────────────────

export type YearToDateStatus =
  | { kind: "not_started" }
  | { kind: "no_plan" }
  | {
      kind: "on_budget" | "under" | "over";
      phase: "in_progress" | "ended";
      amount: number;
      plannedToDate: number;
    };

// Compare spend so far against the *pro-rated* plan for the elapsed part of
// the year, rather than the full-year plan. Mid-year, "planned − actual" is
// meaningless (most of the plan hasn't come due yet); this answers "am I
// ahead of or behind where the plan says I should be right now?".
export function yearToDateStatus(
  plannedByMonth: number[],
  actualToDate: number,
  year: number,
  now: Date,
): YearToDateStatus {
  const thisYear = now.getFullYear();
  if (thisYear < year) return { kind: "not_started" };

  const plannedYear = sumArray(plannedByMonth);
  if (plannedYear === 0 && actualToDate === 0) return { kind: "no_plan" };

  const fractions = expectedProgressFractions(year, now);
  let plannedToDate = 0;
  for (let i = 0; i < 12; i++) {
    plannedToDate += (plannedByMonth[i] ?? 0) * (fractions[i] ?? 0);
  }
  plannedToDate = Math.round(plannedToDate);

  const phase = thisYear > year ? "ended" : "in_progress";
  const diff = plannedToDate - actualToDate;
  if (diff === 0) return { kind: "on_budget", phase, amount: 0, plannedToDate };
  if (diff > 0) return { kind: "under", phase, amount: diff, plannedToDate };
  return { kind: "over", phase, amount: -diff, plannedToDate };
}

// Suggest a name for a budget copied into another year: swap the source year
// if it appears in the name ("Husholdning 2026" → "Husholdning 2027"),
// otherwise append the target year.
export function defaultCopyName(
  name: string,
  sourceYear: number,
  targetYear: number,
): string {
  const trimmed = name.trim();
  const from = String(sourceYear);
  if (trimmed.includes(from)) return trimmed.replace(from, String(targetYear));
  return `${trimmed} ${targetYear}`;
}
