/**
 * Bank-text sanitization.
 *
 * Banks wrap merchant names in noise: card/channel prefixes ("DK KORT",
 * "Dankort", "Visa/Dankort", "MobilePay"), trailing dates, and reference /
 * card-tail numbers. `sanitizeBankText` strips that noise and returns a
 * display-friendly description.
 *
 * This is the shared primitive used by:
 *  - the CSV import path (cleans the stored `description`; the raw original is
 *    preserved in `metadata.rawDescription`),
 *  - the CSV import preview (same function client-side, so the user sees the
 *    final text before confirming),
 *  - `deriveMerchantKey` (Phase 2), which builds its key on top of this.
 *
 * Pure, dependency-free and isomorphic (safe to import client-side).
 * Idempotent: running it on already-clean text is a no-op.
 *
 * Known limitation: casing of arbitrary brand names is imperfect
 * ("McDonald's" -> "Mcdonald's"). The untouched original is always kept in
 * `metadata.rawDescription`, so no information is lost.
 */

/**
 * Leading card/channel prefixes to strip. Order matters: longer / multi-word
 * prefixes are listed first so they match before their shorter substrings
 * ("visa/dankort" before "visa").
 */
const LEADING_PREFIXES: readonly string[] = [
  "visa/dankort køb",
  "visa/dankort",
  "visa køb",
  "visa kort",
  "dankort-nota",
  "dankort-køb",
  "dankort køb",
  "dankortkøb",
  "dankort",
  "dk-kort",
  "dk kort",
  "dkkort",
  "kort dk",
  "kortkøb",
  "kort køb",
  "maestro",
  "mastercard",
  "betalingsservice",
  "automatudbetaling",
  "hæveautomat",
  "hævning",
  "straksoverførsel",
  "overførsel",
  // NB: "indbetaling"/"udbetaling" are intentionally NOT stripped — they are
  // part of real payer names ("Udbetaling Danmark") more often than pure noise.
  "mobilepay",
  "mobile pay",
  "mob.pay",
  "mobp",
  // Statement-type lead-ins that wrap the real payee ("Forretning: Proton",
  // "Ydelse 0111261 Boliglån"). A leading ref/contract number is stripped
  // separately, see `stripLeadingPrefixes`.
  "forretning",
  "ydelse",
  "bgs",
  "bs",
  "køb",
];

/**
 * Trailing reference markers — when the last token is one of these (optionally
 * followed by a number that was already stripped), drop it too.
 */
const REF_MARKERS = new Set(["kortnr", "ref", "nota", "notanr", "bilag"]);

/**
 * Trailing 2-letter country codes appended by card networks
 * ("Thomann De Dk" -> "Thomann"). Kept conservative: only unambiguous codes
 * that are not also common standalone merchant suffixes (e.g. "it" for IT firms
 * is intentionally excluded).
 */
const COUNTRY_CODES = new Set(["dk", "de", "se", "no", "nl", "gb", "uk"]);

/**
 * A prefix may be followed by any of these before the merchant starts:
 * whitespace, colon ("Mobilepay: ..."), asterisk ("Mob.pay*..."), or hyphen.
 */
const PREFIX_SEPARATOR = /[\s:*-]/;
const LEADING_SEPARATORS = /^[\s:*-]+/;

/** Canonical casing for known acronyms / brand stems (lowercased key). */
const BRAND_CASING: Record<string, string> = {
  "h&m": "H&M",
  ok: "OK",
  ikea: "IKEA",
  dsb: "DSB",
  sas: "SAS",
  klm: "KLM",
  atp: "ATP",
  su: "SU",
  hk: "HK",
  "3f": "3F",
  tdc: "TDC",
  pfa: "PFA",
  q8: "Q8",
  hbo: "HBO",
  br: "BR",
  g4s: "G4S",
  kab: "KAB",
  dab: "DAB",
  ase: "ASE",
};

const DATE_RE =
  /^(?:\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?|\d{4}[./-]\d{1,2}[./-]\d{1,2})$/;
const YEAR_RE = /^(?:19|20)\d{2}$/;
const DIGITS_RE = /^\d+$/;
const ALPHA_RE = /[a-zæøå]/i;

function isDateToken(token: string): boolean {
  return DATE_RE.test(token);
}

/**
 * A trailing digit group counts as noise (ref / card-tail / id / year) when it
 * is 4+ digits long. Bare 4-digit groups are ambiguous (e.g. "Rema 1000" the
 * brand vs "5512" a card tail), so the brand slot is shielded separately via
 * `protectedIndex`; everything else of length >= 4 is treated as noise.
 */
function isNoiseDigits(token: string): boolean {
  return DIGITS_RE.test(token) && token.length >= 4;
}

/**
 * NFC-normalize, collapse whitespace, and repair common bank-export artifacts:
 *  - "ø" mangled to "@" inside a word ("R@NNEDE" -> "Rønnede"),
 *  - a dangling trailing slash / asterisk ("ZINKBAKKEN.DK/" -> "ZINKBAKKEN.DK").
 */
function normalizeWhitespace(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(\p{L})@(\p{L})/gu, "$1ø$2")
    .replace(/[/*]+$/, "")
    .trim();
}

/**
 * Split a store/terminal number glued between a brand and a location
 * ("LIDL225HASLEV" -> "LIDL 225 HASLEV"). Requires 2+ digits flanked by letters
 * so brand names that legitimately end in a single digit (Q8, TV2, G4S) and
 * pure-numeric ids are left untouched. Applied AFTER prefix stripping so it
 * never disturbs a glued reference code (e.g. "DK-NOTAf145d").
 */
function splitGluedStoreCode(text: string): string {
  return text.replace(/(\p{L})(\d{2,})(\p{L})/gu, "$1 $2 $3");
}

/** Strip leading card/channel prefixes and a leading "den <date>". */
function stripLeadingPrefixes(text: string): string {
  let current = text;
  let changed = true;
  while (changed) {
    changed = false;
    const lower = current.toLowerCase();

    // "den 28.05 ..." — Danish "on <date>" lead-in.
    const denMatch = /^den\s+(\S+)\s*/i.exec(current);
    if (denMatch && isDateToken(denMatch[1]!.toLowerCase())) {
      current = current.slice(denMatch[0].length);
      changed = true;
      continue;
    }

    // "DK-NOTA52017 ZINKBAKKEN" / "DANKORT-NOTA F145D SAXO" — a card-nota line
    // whose reference code is glued to (or spaced after) the "NOTA" marker.
    const notaMatch = /^(?:dankort|dk)-?nota[0-9a-zæøå]*(?:\s+|$)/i.exec(current);
    if (notaMatch && notaMatch[0].length < current.length) {
      current = current.slice(notaMatch[0].length);
      changed = true;
      continue;
    }

    // A leading bare date or reference/contract/account number left in front of
    // the merchant by a channel word ("Ydelse 0111261 Boliglån" -> "Boliglån").
    // A pure-digit FIRST token is an id, never a merchant. Never strip the only
    // remaining token (so a bare ref row keeps its number for the null check).
    const leadMatch = /^(\S+)(?:\s+|$)/.exec(current);
    if (leadMatch) {
      const token = leadMatch[1]!.toLowerCase();
      const rest = current.slice(leadMatch[0].length);
      if (
        rest.trim().length > 0 &&
        (isDateToken(token) || (DIGITS_RE.test(token) && token.length >= 4))
      ) {
        current = rest;
        changed = true;
        continue;
      }
    }

    for (const prefix of LEADING_PREFIXES) {
      if (
        lower === prefix ||
        (lower.startsWith(prefix) &&
          PREFIX_SEPARATOR.test(lower.charAt(prefix.length)))
      ) {
        current = current.slice(prefix.length).replace(LEADING_SEPARATORS, "");
        changed = true;
        break;
      }
    }
  }
  return current;
}

/** Strip trailing dates, reference markers and ref/card-tail digit groups. */
function stripTrailingNoise(text: string): string {
  const tokens = text.split(" ").filter(Boolean);
  if (tokens.length <= 1) return text;

  // Preserve a 4-digit brand token like "Rema 1000": the 2nd token when the
  // 1st is alphabetic. (Years and 5+ digit ids are still treated as noise.)
  const protectedIndex =
    tokens[0] &&
    ALPHA_RE.test(tokens[0]) &&
    tokens[1] &&
    DIGITS_RE.test(tokens[1]) &&
    tokens[1].length === 4 &&
    !YEAR_RE.test(tokens[1])
      ? 1
      : -1;

  while (tokens.length > 1) {
    const idx = tokens.length - 1;
    const last = tokens[idx]!;
    const lower = last.toLowerCase();

    if (idx === protectedIndex) break;

    if (isDateToken(lower) || isNoiseDigits(lower)) {
      tokens.pop();
      continue;
    }
    if (COUNTRY_CODES.has(lower)) {
      tokens.pop();
      continue;
    }
    if (REF_MARKERS.has(lower) || lower === "den" || lower === "kl") {
      // "den"/"kl" are date/time lead-ins left dangling once their number was
      // stripped (e.g. "... den 28.05" -> "... den" -> "...").
      tokens.pop();
      continue;
    }
    break;
  }

  return tokens.join(" ");
}

/** Capitalize a single word, honoring the brand-casing map. */
function caseWord(word: string): string {
  const lower = word.toLowerCase();
  const brand = BRAND_CASING[lower];
  if (brand) return brand;
  if (!ALPHA_RE.test(word)) return word; // pure digits / symbols
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function toDisplayCase(text: string): string {
  return text
    .split(" ")
    .filter(Boolean)
    .map(caseWord)
    .join(" ");
}

/**
 * Strip bank noise WITHOUT the display fallback or casing. Returns the cleaned
 * core (original case), which is empty when the text was pure channel/transfer
 * noise (e.g. a bare "Overførsel"). Used by `deriveMerchantKey` to distinguish
 * "no merchant" (→ null rule) from a real merchant.
 */
export function stripBankNoise(raw: string): string {
  const normalized = normalizeWhitespace(raw);
  if (!normalized) return "";
  const deprefixed = splitGluedStoreCode(stripLeadingPrefixes(normalized));
  return stripTrailingNoise(deprefixed).trim();
}

/**
 * Turn a noisy bank description into a display-friendly merchant name.
 * Never returns an empty string for non-empty input: if stripping removes
 * everything (e.g. a bare "Overførsel"), the original text is title-cased and
 * returned instead.
 */
export function sanitizeBankText(raw: string): string {
  const normalized = normalizeWhitespace(raw);
  if (!normalized) return "";

  // Stripping emptied it (pure channel/transfer text) — fall back to the
  // normalized original so we never store an empty description.
  return toDisplayCase(stripBankNoise(raw) || normalized);
}
