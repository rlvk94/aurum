import type { DateFormat, NumberFormat } from "./types";

/**
 * Parse a number string in either comma-decimal ("1.234,56") or
 * dot-decimal ("1,234.56") format and return cents (signed integer).
 * Returns null if the input doesn't parse to a finite number.
 */
export function parseAmount(s: string, format: NumberFormat): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  let cleaned = trimmed;
  if (format === "comma-decimal") {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(/,/g, "");
  }
  // Strip stray spaces that some banks insert as thousands separator.
  cleaned = cleaned.replace(/\s+/g, "");
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Parse a date string in a known format and return ISO YYYY-MM-DD, or null.
 *
 * Day and month accept 1-2 digit values (so "5/1/2024" parses as "2024-01-05"
 * under the dd/MM/yyyy format). The year part is always 4 digits.
 */
export function parseDate(s: string, format: DateFormat): string | null {
  const trimmed = s.trim();
  if (!trimmed) return null;

  let y: string | undefined;
  let m: string | undefined;
  let d: string | undefined;

  switch (format) {
    case "yyyy-MM-dd": {
      const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
      if (!match) return null;
      [, y, m, d] = match;
      break;
    }
    case "yyyy/MM/dd": {
      const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(trimmed);
      if (!match) return null;
      [, y, m, d] = match;
      break;
    }
    case "yyyy.MM.dd": {
      const match = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(trimmed);
      if (!match) return null;
      [, y, m, d] = match;
      break;
    }
    case "dd-MM-yyyy": {
      const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(trimmed);
      if (!match) return null;
      [, d, m, y] = match;
      break;
    }
    case "dd/MM/yyyy": {
      const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
      if (!match) return null;
      [, d, m, y] = match;
      break;
    }
    case "dd.MM.yyyy": {
      const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
      if (!match) return null;
      [, d, m, y] = match;
      break;
    }
    case "MM/dd/yyyy": {
      const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
      if (!match) return null;
      [, m, d, y] = match;
      break;
    }
  }

  if (!y || !m || !d) return null;
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const mm = m.padStart(2, "0");
  const dd = d.padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}
