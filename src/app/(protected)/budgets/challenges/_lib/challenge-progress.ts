import { format, parseISO } from "date-fns";
import { da, enUS } from "date-fns/locale";

export type ChallengeType =
  | "spend_less"
  | "savings"
  | "pay_off_loan"
  | "net_worth_goal";

export function formatAmount(cents: number): string {
  const value = Math.abs(cents) / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  return `${cents < 0 ? "-" : ""}${formatted} kr.`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`);
  const b = new Date(`${toIso}T00:00:00Z`);
  return Math.round((+b - +a) / 86_400_000);
}

function pickLocale(locale: string) {
  return locale.startsWith("da") ? da : enUS;
}

export function formatPeriodRange(
  startIso: string,
  endIso: string,
  locale: string,
): string {
  const start = parseISO(startIso);
  const end = parseISO(endIso);
  const dateLocale = pickLocale(locale);
  const currentYear = new Date().getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();
  const inCurrentYear = sameYear && start.getFullYear() === currentYear;

  const startFmt = inCurrentYear || sameYear ? "d. MMM" : "d. MMM yyyy";
  const endFmt = inCurrentYear ? "d. MMM" : "d. MMM yyyy";

  return `${format(start, startFmt, { locale: dateLocale })} – ${format(end, endFmt, { locale: dateLocale })}`;
}

export type OnTrackInput = {
  type: ChallengeType;
  ratio: number;
  periodStartIso: string;
  periodEndIso: string;
  todayIso: string;
};

export function computeOnTrack({
  type,
  ratio,
  periodStartIso,
  periodEndIso,
  todayIso,
}: OnTrackInput): boolean | null {
  const notStarted = periodStartIso > todayIso;
  const ended = periodEndIso < todayIso;
  if (notStarted || ended) return null;
  const totalDays = Math.max(
    1,
    daysBetween(periodStartIso, periodEndIso) + 1,
  );
  const elapsed = Math.max(
    0,
    Math.min(totalDays, daysBetween(periodStartIso, todayIso) + 1),
  );
  const elapsedFrac = elapsed / totalDays;
  if (type === "spend_less") {
    return ratio <= elapsedFrac + 0.01;
  }
  return ratio >= elapsedFrac - 0.01;
}

export function pickProgressColor(
  type: ChallengeType,
  ratio: number,
  target: number,
  progress: number,
  onTrack: boolean | null,
): string {
  if (type === "spend_less") {
    const isOver = progress > target;
    if (isOver) return "bg-expense";
    return onTrack ? "bg-primary" : "bg-warning";
  }
  const met = progress >= target;
  if (met) return "bg-income";
  return onTrack ? "bg-primary" : "bg-warning";
}

export function pickAmountLabelKey(type: ChallengeType): string {
  switch (type) {
    case "spend_less":
      return "challengeSpent";
    case "savings":
      return "challengeSaved";
    case "net_worth_goal":
      return "challengeNetWorth";
    case "pay_off_loan":
      return "challengePaid";
  }
}
