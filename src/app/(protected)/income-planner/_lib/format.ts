// Formatters shared by the income planner UI. Amounts are stored in øre (cents);
// percentages in basis points (2500 = 25.00%).

const moneyFormatter = new Intl.NumberFormat("da-DK", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const moneyFormatterDecimals = new Intl.NumberFormat("da-DK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("da-DK", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function formatMoney(cents: number, withDecimals = false): string {
  const value = Math.abs(cents) / 100;
  const fmt = withDecimals ? moneyFormatterDecimals : moneyFormatter;
  const formatted = fmt.format(value);
  return `${cents < 0 ? "-" : ""}${formatted} kr.`;
}

export function formatPercentBps(bps: number): string {
  return `${percentFormatter.format(bps / 100)}%`;
}

// Convert a fixed cent value to basis points (share of total). All derivations
// of % from a fixed kr. amount go through this so the hero bar and row
// counterparts round identically.
export function bpsFromCents(cents: number, totalCents: number): number {
  if (totalCents <= 0) return 0;
  return Math.round((cents / totalCents) * 10_000);
}

// Format an integer-kroner amount with Danish grouping (e.g. 47000 → "47.000").
// For use in inputs that are cleared on focus and formatted on blur.
export function formatKronerInt(kroner: number): string {
  return moneyFormatter.format(kroner);
}

// Parse a user-typed amount (localised "1.234,50" or plain "1234.50") into øre.
export function parseMoneyInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Accept both Danish ("1.234,50") and plain ("1234.50") formats. Strip
  // grouping periods, then convert the decimal comma to a dot.
  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

// Parse a user-typed percentage into basis points (e.g. "12.5" or "12,5" → 1250).
export function parsePercentInput(raw: string): number | null {
  const trimmed = raw.trim().replace("%", "").replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
