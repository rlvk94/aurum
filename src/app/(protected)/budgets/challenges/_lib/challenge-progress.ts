import { format, parseISO } from "date-fns";
import { da, enUS } from "date-fns/locale";

// On/off-track math now lives in a shared, server-safe module; re-exported here
// so existing client imports keep working unchanged.
import {
  computeOnTrack,
  daysBetween,
  type ChallengeType,
  type OnTrackInput,
} from "~/lib/challenge-on-track";

export { computeOnTrack, daysBetween };
export type { ChallengeType, OnTrackInput };

export function formatAmount(cents: number): string {
  const value = Math.abs(cents) / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  return `${cents < 0 ? "-" : ""}${formatted} kr.`;
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
