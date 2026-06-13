export type Repetition = "one_off" | "weekly" | "monthly" | "yearly" | "custom";

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate();
}

function addMonthsClamped(d: Date, n: number): Date {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + n;
  const day = d.getUTCDate();
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay));
}

function addYearsClamped(d: Date, n: number): Date {
  const year = d.getUTCFullYear() + n;
  const month = d.getUTCMonth();
  const day = Math.min(d.getUTCDate(), daysInMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

/**
 * Returns the period window containing `asOf` for a challenge anchored at
 * `startDate`. Periods are anchored to startDate (not calendar boundaries):
 * a monthly challenge starting on the 15th runs 15→14 each month.
 * For `one_off` returns the fixed [startDate, endDate] window.
 */
export function computePeriodWindow(
  repetition: Repetition,
  startDate: string,
  endDate: string | null,
  customDurationDays: number | null,
  asOf: string,
): { from: string; to: string } {
  if (repetition === "one_off") {
    if (!endDate) {
      throw new Error("one_off challenge missing endDate");
    }
    return { from: startDate, to: endDate };
  }

  const start = parseIso(startDate);
  const target = parseIso(asOf);
  const MS_PER_DAY = 86_400_000;

  if (repetition === "weekly" || repetition === "custom") {
    const stride = repetition === "weekly" ? 7 : (customDurationDays ?? 0);
    if (stride <= 0) {
      throw new Error("custom challenge missing customDurationDays");
    }
    const daysDiff = Math.floor((+target - +start) / MS_PER_DAY);
    const periodIndex = Math.max(0, Math.floor(daysDiff / stride));
    const periodStart = addDays(start, periodIndex * stride);
    const periodEnd = addDays(periodStart, stride - 1);
    return { from: toIso(periodStart), to: toIso(periodEnd) };
  }

  if (repetition === "monthly" || repetition === "yearly") {
    // Re-anchor each period to the original start so end-of-month behaviour is
    // stable (a Jan-31 monthly challenge runs Jan 31, Feb 28, Mar 31, ... —
    // periods don't drift forward after short months).
    const step = repetition === "monthly" ? addMonthsClamped : addYearsClamped;
    for (let i = 0; i < 1200; i++) {
      const periodStart = step(start, i);
      const nextStart = step(start, i + 1);
      if (+target < +nextStart) {
        const periodEnd = addDays(nextStart, -1);
        return { from: toIso(periodStart), to: toIso(periodEnd) };
      }
    }
    throw new Error("period resolution exceeded safety cap");
  }

  throw new Error(`unknown repetition: ${repetition as string}`);
}

export function nextPeriodStart(periodEndIso: string): string {
  return toIso(addDays(parseIso(periodEndIso), 1));
}
