/**
 * Merchant-signature derivation for the self-learning rules layer.
 *
 * Turns a (noisy) bank transaction into a stable "merchant key" so that
 * categorizing one "NETTO HØRSHOLM 1234" teaches a rule that also fires for
 * next month's "NETTO LYNGBY 5678". Builds on `stripBankNoise` (the shared
 * Phase-1 stripper) so prefix/date/ref handling lives in exactly one place.
 *
 * Returns `null` when there is no real merchant (transfers, bare reference
 * rows) — that short-circuits both learning and rule-matching.
 *
 * Pure, deterministic, idempotent.
 */

import { stripBankNoise } from "./sanitize";

/** Corporate-form / locale filler that never identifies a merchant. */
const FILLER = new Set([
  "as",
  "a/s",
  "aps",
  "ivs",
  "intl",
  "dk",
  "denmark",
  "danmark",
  "nr",
]);

const TOKEN_SPLIT = /[^a-z0-9æøå&+'-]+/;

/** Significant lowercase words of a cleaned string, filler removed. */
function significantWords(core: string): string[] {
  return core
    .toLocaleLowerCase("da-DK")
    .split(TOKEN_SPLIT)
    .filter((w) => w.length > 0 && !FILLER.has(w));
}

function keyFromText(text: string): string | null {
  const core = stripBankNoise(text);
  if (!core) return null;

  const words = significantWords(core);
  if (words.length === 0) return null;

  // The brand leads DK card lines, so the FIRST significant token is the key.
  // Using only the first token keeps the key stable across locations and extra
  // words ("Netto Hørsholm" / "Netto Lyngby" -> "netto"; "H&M" / "H&M Magasin"
  // -> "h&m") — essential so a learned rule fires on every variant.
  const key = words[0]!;

  // A purely numeric "key" is a reference/account number, not a merchant.
  if (/^[0-9]+$/.test(key)) return null;

  return key;
}

/**
 * Derive a stable merchant key from a transaction. Prefers the description;
 * falls back to the safelisted `payer` metadata when the description carries no
 * merchant (e.g. some incoming transfers name the payer separately).
 */
export function deriveMerchantKey(
  description: string,
  metadata?: Record<string, string> | null,
): string | null {
  return keyFromText(description) ?? keyFromText(metadata?.payer ?? "");
}
