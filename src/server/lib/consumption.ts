/**
 * Pure consumption maths for the meter tracker (ADR-0026). No `server-only`
 * and no db imports so the client can import types/helpers too (precedent:
 * `~/server/lib/amortization` is imported by `debts-client.tsx`).
 *
 * Readings are cumulative counter values on a calendar date. Consumption is
 * never stored — it is the difference between consecutive readings, spread
 * pro-rata by days across the calendar months an interval overlaps. A reading
 * is taken at the *start* of its day, so the interval between two readings
 * covers the half-open day range `[from, to)`. That is what makes a reading
 * on the 1st of every month produce exact calendar months with zero leakage,
 * while mid-month or weekly readers get proportional splits.
 *
 * All values are integer milli-units (×1000). All dates are ISO `YYYY-MM-DD`
 * strings and the arithmetic is done in UTC.
 */

import { type ReminderCadence } from "~/lib/consumption-kinds";

export {
  METER_KINDS,
  REMINDER_CADENCES,
  VALUE_SCALE,
  fromMilli,
  toMilli,
} from "~/lib/consumption-kinds";
export type { MeterKind, ReminderCadence } from "~/lib/consumption-kinds";

const MS_PER_DAY = 86_400_000;

// ── Date helpers ────────────────────────────────────────────────────────────

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Whole days from `fromIso` to `toIso`; negative when `toIso` is earlier. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((+parseIso(toIso) - +parseIso(fromIso)) / MS_PER_DAY);
}

/** `month` is 1..12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Clamp a configured day (1..31) into the given month, so 31 = last day. */
export function clampDayOfMonth(
  year: number,
  month: number,
  day: number,
): number {
  return Math.min(day, daysInMonth(year, month));
}

/** ISO weekday 1 (Monday) .. 7 (Sunday). */
export function isoWeekday(iso: string): number {
  const d = parseIso(iso).getUTCDay();
  return d === 0 ? 7 : d;
}

export function addDaysIso(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

/**
 * Today's calendar date in Europe/Copenhagen (the app's region). The cron
 * sweep runs early morning, when UTC and local dates can differ.
 */
export function copenhagenToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// ── Readings → intervals ────────────────────────────────────────────────────

export type ReadingLike = {
  id: string;
  date: string;
  /** Milli-units. */
  value: number;
  /** New meter installed / counter reset — the interval ending here is unknown. */
  isMeterReset: boolean;
};

export type Interval = {
  fromReadingId: string;
  toReadingId: string;
  fromDate: string;
  toDate: string;
  /** Length of `[fromDate, toDate)` in days, always ≥ 1. */
  days: number;
  /** Milli-units; null when unknown (meter reset or defensive negative). */
  consumption: number | null;
  perDay: number | null;
};

export function sortReadings<T extends { date: string }>(readings: T[]): T[] {
  return [...readings].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

export function buildIntervals(readings: ReadingLike[]): Interval[] {
  const sorted = sortReadings(readings);
  const out: Interval[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const days = daysBetween(prev.date, cur.date);
    // Same-day duplicates cannot exist (unique index) — skip defensively.
    if (days <= 0) continue;
    let consumption: number | null = cur.isMeterReset
      ? null
      : cur.value - prev.value;
    // The router enforces monotonic non-reset readings; clamp anyway so a
    // transient violation never renders a negative bar.
    if (consumption !== null && consumption < 0) consumption = null;
    out.push({
      fromReadingId: prev.id,
      toReadingId: cur.id,
      fromDate: prev.date,
      toDate: cur.date,
      days,
      consumption,
      perDay: consumption === null ? null : consumption / days,
    });
  }
  return out;
}

/**
 * The single invariant on a meter's readings: a non-reset reading may not be
 * lower than the reading before it (by date). Returns the first violation or
 * null. Callers apply their proposed change to the in-memory list and validate
 * the whole sequence — this covers create, update, date moves, reset toggles,
 * bulk upserts and deletes uniformly.
 */
export function validateReadingSequence(
  readings: ReadingLike[],
): { readingId: string; previousReadingId: string } | null {
  const sorted = sortReadings(readings);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (!cur.isMeterReset && cur.value < prev.value) {
      return { readingId: cur.id, previousReadingId: prev.id };
    }
  }
  return null;
}

// ── Calendar-month normalisation ────────────────────────────────────────────

export type MonthBucket = {
  year: number;
  /** 1..12 */
  month: number;
  daysInMonth: number;
  /** Days covered by intervals with known consumption. */
  coveredDays: number;
  /** Days covered only by reset (unknown) intervals. */
  unknownDays: number;
  /** coveredDays / daysInMonth, 0..1 */
  coverage: number;
  isComplete: boolean;
  /** Pro-rata milli-units, rounded; null when nothing is covered. */
  consumption: number | null;
};

/**
 * Spread every interval's consumption over the calendar months it overlaps,
 * weighted by days, and return 12 buckets per year in `[fromYear, toYear]`.
 * Per-bucket rounding can drift ±1 milli-unit from the interval total —
 * accepted for display data.
 */
export function bucketByMonth(
  intervals: Interval[],
  fromYear: number,
  toYear: number,
): Record<number, MonthBucket[]> {
  const raw = new Map<
    string,
    { covered: number; unknown: number; sum: number }
  >();

  for (const iv of intervals) {
    let cursor = parseIso(iv.fromDate);
    const endExclusive = parseIso(iv.toDate);
    while (cursor < endExclusive) {
      const y = cursor.getUTCFullYear();
      const m = cursor.getUTCMonth() + 1;
      const nextMonth = new Date(Date.UTC(y, m, 1));
      const segEnd = nextMonth < endExclusive ? nextMonth : endExclusive;
      const overlap = Math.round((+segEnd - +cursor) / MS_PER_DAY);
      if (y >= fromYear && y <= toYear) {
        const key = `${y}-${m}`;
        const entry = raw.get(key) ?? { covered: 0, unknown: 0, sum: 0 };
        if (iv.perDay === null) {
          entry.unknown += overlap;
        } else {
          entry.covered += overlap;
          entry.sum += iv.perDay * overlap;
        }
        raw.set(key, entry);
      }
      cursor = segEnd;
    }
  }

  const result: Record<number, MonthBucket[]> = {};
  for (let y = fromYear; y <= toYear; y++) {
    result[y] = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const dim = daysInMonth(y, m);
      const entry = raw.get(`${y}-${m}`);
      const covered = entry?.covered ?? 0;
      return {
        year: y,
        month: m,
        daysInMonth: dim,
        coveredDays: covered,
        unknownDays: entry?.unknown ?? 0,
        coverage: covered / dim,
        isComplete: covered === dim,
        consumption: covered > 0 && entry ? Math.round(entry.sum) : null,
      };
    });
  }
  return result;
}

export type YearSummary = {
  year: number;
  completeMonths: number;
  /** Sum of complete months only, milli-units. */
  total: number;
  averagePerMonth: number | null;
  /** Months complete in both this and the previous year. */
  comparedMonths: number;
  /** Like-for-like change vs previous year over `comparedMonths`, in bps. */
  changeVsPreviousYearBps: number | null;
};

/**
 * Yearly totals over complete months. The year-over-year change is computed
 * like-for-like (only months complete in both years) because heat and
 * electricity are strongly seasonal — Jan–Aug vs a full prior year would be
 * meaningless.
 */
export function summarizeYears(
  months: Record<number, MonthBucket[]>,
): YearSummary[] {
  const years = Object.keys(months)
    .map(Number)
    .sort((a, b) => a - b);
  return years.map((year) => {
    const cur = months[year]!;
    const prev = months[year - 1];
    const complete = cur.filter((b) => b.isComplete);
    const total = complete.reduce((acc, b) => acc + (b.consumption ?? 0), 0);

    let comparedMonths = 0;
    let curSum = 0;
    let prevSum = 0;
    if (prev) {
      for (let i = 0; i < 12; i++) {
        const a = cur[i]!;
        const b = prev[i]!;
        if (a.isComplete && b.isComplete) {
          comparedMonths++;
          curSum += a.consumption ?? 0;
          prevSum += b.consumption ?? 0;
        }
      }
    }

    return {
      year,
      completeMonths: complete.length,
      total,
      averagePerMonth:
        complete.length > 0 ? Math.round(total / complete.length) : null,
      comparedMonths,
      changeVsPreviousYearBps:
        comparedMonths > 0 && prevSum > 0
          ? Math.round(((curSum - prevSum) / prevSum) * 10_000)
          : null,
    };
  });
}

export type LastCompleteMonth = {
  year: number;
  month: number;
  consumption: number;
  /** Same month one year earlier, if that month is complete. */
  previousYearConsumption: number | null;
};

/**
 * The most recent complete month on or before `todayIso`, scanning back across
 * the years present in `months`. Used by list cards and the dashboard.
 */
export function findLastCompleteMonth(
  months: Record<number, MonthBucket[]>,
  todayIso: string,
): LastCompleteMonth | null {
  const { y: thisYear, m: thisMonth } = ymd(todayIso);
  const years = Object.keys(months)
    .map(Number)
    .sort((a, b) => a - b);
  const minYear = years[0];
  if (minYear === undefined) return null;
  let y = thisYear;
  let m = thisMonth;
  while (y >= minYear) {
    const bucket = months[y]?.[m - 1];
    if (bucket?.isComplete && bucket.consumption !== null) {
      const prev = months[y - 1]?.[m - 1];
      return {
        year: y,
        month: m,
        consumption: bucket.consumption,
        previousYearConsumption:
          prev?.isComplete && prev.consumption !== null
            ? prev.consumption
            : null,
      };
    }
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return null;
}

// ── Reminder schedule ───────────────────────────────────────────────────────

export type ReminderSettings = {
  enabled: boolean;
  cadence: ReminderCadence;
  /** 1..31; 31 means "last day of the month" in shorter months. */
  dayOfMonth: number;
  /** ISO weekday 1..7. */
  weekday: number;
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  cadence: "monthly",
  dayOfMonth: 1,
  weekday: 1,
};

function ymd(iso: string): { y: number; m: number; d: number } {
  const date = parseIso(iso);
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
  };
}

export function isReminderDueToday(
  settings: ReminderSettings,
  todayIso: string,
): boolean {
  if (!settings.enabled) return false;
  if (settings.cadence === "weekly") {
    return isoWeekday(todayIso) === settings.weekday;
  }
  const { y, m, d } = ymd(todayIso);
  return d === clampDayOfMonth(y, m, settings.dayOfMonth);
}

/** Most recent due date on or before `todayIso` (ignores `enabled`). */
export function previousDueDate(
  settings: ReminderSettings,
  todayIso: string,
): string {
  if (settings.cadence === "weekly") {
    const back = (isoWeekday(todayIso) - settings.weekday + 7) % 7;
    return addDaysIso(todayIso, -back);
  }
  let { y, m } = ymd(todayIso);
  const { d } = ymd(todayIso);
  let candidate = clampDayOfMonth(y, m, settings.dayOfMonth);
  if (candidate > d) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    candidate = clampDayOfMonth(y, m, settings.dayOfMonth);
  }
  return toIso(new Date(Date.UTC(y, m - 1, candidate)));
}

/** First due date on or after `todayIso` (ignores `enabled`). */
export function nextDueDate(
  settings: ReminderSettings,
  todayIso: string,
): string {
  if (settings.cadence === "weekly") {
    const forward = (settings.weekday - isoWeekday(todayIso) + 7) % 7;
    return addDaysIso(todayIso, forward);
  }
  let { y, m } = ymd(todayIso);
  const { d } = ymd(todayIso);
  let candidate = clampDayOfMonth(y, m, settings.dayOfMonth);
  if (candidate < d) {
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
    candidate = clampDayOfMonth(y, m, settings.dayOfMonth);
  }
  return toIso(new Date(Date.UTC(y, m - 1, candidate)));
}

/**
 * Grace used when a family has not switched the reminder on: we don't know
 * their reading day, so only flag clearly stale meters.
 */
const OVERDUE_GRACE_DAYS: Record<ReminderCadence, number> = {
  monthly: 35,
  weekly: 9,
};

export function isReadingOverdue(
  settings: ReminderSettings,
  lastReadingDate: string | null,
  todayIso: string,
): boolean {
  if (lastReadingDate === null) return true;
  if (settings.enabled) {
    return lastReadingDate < previousDueDate(settings, todayIso);
  }
  return (
    daysBetween(lastReadingDate, todayIso) >
    OVERDUE_GRACE_DAYS[settings.cadence]
  );
}
