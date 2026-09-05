// Formatting and parsing for meter quantities. Values are integer milli-units
// (×1000, see src/lib/consumption-kinds.ts). Numbers are always rendered the
// Danish way (period grouping, comma decimal) — the app-wide convention that
// formatMoney follows too — while dates follow the active locale.

import { format, parseISO } from "date-fns";
import { da, enUS } from "date-fns/locale";

import { METER_MAX_DECIMALS, VALUE_SCALE } from "~/lib/consumption-kinds";

const MINUS = "−"; // U+2212, matches the budget variance pills

function clampDecimals(decimals: number): number {
  return Math.max(0, Math.min(METER_MAX_DECIMALS, Math.trunc(decimals)));
}

const formatterCache = new Map<string, Intl.NumberFormat>();
function numberFormat(min: number, max: number, grouping: boolean) {
  const key = `${min}-${max}-${grouping ? "g" : "n"}`;
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("da-DK", {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      useGrouping: grouping,
    });
    formatterCache.set(key, fmt);
  }
  return fmt;
}

/** Normalise user-typed units: "m3" / "m^3" → "m³"; otherwise trimmed as-is. */
export function formatUnit(unit: string): string {
  const u = unit.trim();
  if (/^m\^?3$/i.test(u)) return "m³";
  return u;
}

/** "1.234,567" — negative values use a real minus sign. */
export function formatNumber(milli: number, decimals: number): string {
  const d = clampDecimals(decimals);
  const s = numberFormat(d, d, true).format(Math.abs(milli) / VALUE_SCALE);
  return milli < 0 ? `${MINUS}${s}` : s;
}

/** "1.234,567 kWh" (no trailing space when the unit is empty). */
export function formatQuantity(
  milli: number,
  decimals: number,
  unit: string,
): string {
  const u = formatUnit(unit);
  const n = formatNumber(milli, decimals);
  return u ? `${n} ${u}` : n;
}

export function formatDelta(
  milli: number | null,
  decimals: number,
  unit: string,
): string {
  return milli === null ? "—" : formatQuantity(milli, decimals, unit);
}

/** "+12%", "−9%", "0%", or "—" for null. Rounded to whole percent. */
export function formatChangePct(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "—";
  const r = Math.round(pct);
  if (r === 0) return "0%";
  return r > 0 ? `+${r}%` : `${MINUS}${Math.abs(r)}%`;
}

/** Percentage change, or null when there is no comparable previous value. */
export function percentChange(
  current: number,
  previous: number | null,
): number | null {
  if (previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Prefill for an input: no grouping, comma decimal, at least the meter's
 * decimals and at most 3 so stored precision is never silently dropped.
 */
export function formatQuantityInput(milli: number, decimals: number): string {
  const d = clampDecimals(decimals);
  const s = numberFormat(d, METER_MAX_DECIMALS, false).format(
    Math.abs(milli) / VALUE_SCALE,
  );
  return milli < 0 ? `-${s}` : s;
}

/**
 * Parse a typed quantity into milli-units. Accepts Danish ("1.234,567"),
 * plain ("1234.567") and grouped-without-decimals ("12.345.678") input:
 * - a comma is always the decimal separator (dots are grouping);
 * - with no comma, two or more dots are grouping;
 * - with no comma and a single dot, the dot is the decimal point.
 * Returns null for anything that isn't a single number. Range checks belong
 * to the form schema.
 */
export function parseQuantityInput(raw: string): number | null {
  const s = raw.replace(/[\s ]/g, "");
  if (!s) return null;
  const commas = (s.match(/,/g) ?? []).length;
  const dots = (s.match(/\./g) ?? []).length;
  if (commas > 1) return null;
  // Dots used as thousands separators must form real groups ("1.234.567").
  const grouped = /^-?\d{1,3}(\.\d{3})+$/;
  let normalized: string;
  if (commas === 1) {
    const [intPart = "", fracPart = ""] = s.split(",");
    if (dots > 0 && !grouped.test(intPart)) return null;
    normalized = `${intPart.replace(/\./g, "")}.${fracPart}`;
  } else if (dots >= 2) {
    if (!grouped.test(s)) return null;
    normalized = s.replace(/\./g, "");
  } else {
    normalized = s;
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * VALUE_SCALE);
}

/** Per-day rates need at least one decimal to be readable. */
export function perDayDecimals(decimals: number): number {
  return Math.max(1, clampDecimals(decimals));
}

/** "3. sep. 2026" / "3 Sep 2026" depending on locale. */
export function formatReadingDate(iso: string, locale: string): string {
  return format(parseISO(iso), locale === "da" ? "d. MMM yyyy" : "d MMM yyyy", {
    locale: locale === "da" ? da : enUS,
  });
}

export type MonthCellState = "none" | "partial" | "complete";

export function monthCellState(cell: {
  consumption: number | null;
  coveredDays: number;
  daysInMonth: number;
}): MonthCellState {
  if (cell.consumption === null || cell.coveredDays === 0) return "none";
  if (cell.coveredDays < cell.daysInMonth) return "partial";
  return "complete";
}
