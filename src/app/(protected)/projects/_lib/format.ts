import { parseISO, differenceInCalendarDays } from "date-fns";

export const PROJECT_PALETTES = [
  "gold",
  "sand",
  "sage",
  "ocean",
  "sky",
  "plum",
  "clay",
  "slate",
] as const;
export type ProjectPalette = (typeof PROJECT_PALETTES)[number];

export const PROJECT_EMOJI_SUGGESTIONS = [
  "🏖️",
  "🏔️",
  "✈️",
  "🛠️",
  "🏠",
  "💐",
  "🎓",
  "🎁",
  "🚗",
  "🐾",
  "💍",
  "🎂",
  "🧳",
  "🎄",
  "🌱",
  "🛋️",
  "🍷",
  "🎟️",
] as const;

export function formatAmount(cents: number, opts?: { decimals?: 0 | 2 }) {
  const decimals = opts?.decimals ?? 0;
  const value = Math.abs(cents) / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${cents < 0 ? "-" : ""}${formatted} kr.`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type ProjectStatus =
  | "no_dates"
  | "not_started"
  | "active"
  | "ended"
  | "met"
  | "over";

export type ProjectProgress = {
  status: ProjectStatus;
  daysLeft: number | null;
  daysToStart: number | null;
  daysSinceEnd: number | null;
  /** Fraction of period elapsed, 0..1, only when both dates exist + active. */
  elapsedFraction: number | null;
  /** Fraction of limit consumed, 0..1, only when limit set. */
  limitFraction: number | null;
  isOnTrack: boolean | null;
};

export function deriveProgress(args: {
  startDate: string | null;
  endDate: string | null;
  spendingLimit: number | null;
  net: number;
  asOfIso?: string;
}): ProjectProgress {
  const today = args.asOfIso ?? todayIso();
  const { startDate, endDate, spendingLimit, net } = args;

  const limitFraction =
    spendingLimit && spendingLimit > 0
      ? Math.max(0, net) / spendingLimit
      : null;

  let status: ProjectStatus = "no_dates";
  let daysLeft: number | null = null;
  let daysToStart: number | null = null;
  let daysSinceEnd: number | null = null;
  let elapsedFraction: number | null = null;

  if (!startDate && !endDate) {
    status = "no_dates";
  } else if (startDate && today < startDate) {
    status = "not_started";
    daysToStart = differenceInCalendarDays(
      parseISO(startDate),
      parseISO(today),
    );
  } else if (endDate && today > endDate) {
    status = "ended";
    daysSinceEnd = differenceInCalendarDays(parseISO(today), parseISO(endDate));
  } else {
    status = "active";
    if (endDate) {
      daysLeft = Math.max(
        0,
        differenceInCalendarDays(parseISO(endDate), parseISO(today)),
      );
    }
    if (startDate && endDate) {
      const total = Math.max(
        1,
        differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1,
      );
      const elapsed = Math.min(
        total,
        Math.max(
          0,
          differenceInCalendarDays(parseISO(today), parseISO(startDate)) + 1,
        ),
      );
      elapsedFraction = elapsed / total;
    }
  }

  // Met / over only meaningful when there's a limit.
  if (limitFraction !== null) {
    if (limitFraction > 1) {
      status = "over";
    } else if (status === "ended") {
      status = "met";
    }
  }

  let isOnTrack: boolean | null = null;
  if (
    status === "active" &&
    elapsedFraction !== null &&
    limitFraction !== null
  ) {
    isOnTrack = limitFraction <= elapsedFraction + 0.02;
  }

  return {
    status,
    daysLeft,
    daysToStart,
    daysSinceEnd,
    elapsedFraction,
    limitFraction,
    isOnTrack,
  };
}
