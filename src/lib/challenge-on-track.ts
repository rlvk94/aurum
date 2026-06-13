/**
 * Pure challenge on/off-track math, shared between the client UI
 * (`budgets/challenges/_lib/challenge-progress.ts` re-exports these) and the
 * server (the notification sweep cron). No `server-only` import and no
 * server-only dependencies — keep it pure so both sides can import it.
 */

export type ChallengeType =
  | "spend_less"
  | "savings"
  | "pay_off_loan"
  | "net_worth_goal";

/** Whole days from `fromIso` to `toIso` (ISO `YYYY-MM-DD`), can be negative. */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`);
  const b = new Date(`${toIso}T00:00:00Z`);
  return Math.round((+b - +a) / 86_400_000);
}

export type OnTrackInput = {
  type: ChallengeType;
  /** progress / targetAmount. */
  ratio: number;
  periodStartIso: string;
  periodEndIso: string;
  todayIso: string;
};

/**
 * Whether a challenge is pacing on track for the current period.
 * - `null` when the period hasn't started or has ended.
 * - spend_less: on track while spend ratio ≤ elapsed-time fraction (+1% buffer).
 * - accumulating types: on track while progress ratio ≥ elapsed fraction (−1%).
 */
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
  const totalDays = Math.max(1, daysBetween(periodStartIso, periodEndIso) + 1);
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
