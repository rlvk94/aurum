import { danishBankParser } from "./danish-bank";
import type { CsvParser, ParsedTransaction } from "./types";
import { readFileAsText } from "./utils";

/** Registered parsers — add new bank formats here. */
export const parsers: CsvParser[] = [danishBankParser];

/**
 * Pick the right parser based on the CSV header, or throw if no parser matches.
 * Tries ISO-8859-1 first (common for Danish exports), then UTF-8.
 */
export async function detectParser(file: File): Promise<CsvParser> {
  const encodings = ["iso-8859-1", "utf-8"];
  for (const encoding of encodings) {
    const text = await readFileAsText(file, encoding);
    const headerLine = text.split(/\r\n|\n|\r/).find((l) => l.trim())?.trim();
    if (!headerLine) continue;
    const parser = parsers.find((p) => p.matches(headerLine));
    if (parser) return parser;
  }
  throw new Error("Unsupported CSV format");
}

export type { CsvParser, ParsedTransaction };
export { normalizeAccountNumber } from "./utils";
