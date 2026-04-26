import { danishBankParser } from "./danish-bank";
import type { CsvEncoding, CsvParser } from "./types";
import { decodeFile } from "./parse-table";

/** Registered parsers — add new bank formats here. */
export const parsers: CsvParser[] = [danishBankParser];

const DETECT_ENCODINGS: CsvEncoding[] = [
  "iso-8859-1",
  "utf-8",
  "windows-1252",
];

/**
 * Pick the right parser based on the CSV header. Returns null when no
 * registered parser matches; the caller drops into the manual mapping flow.
 */
export async function detectParser(file: File): Promise<CsvParser | null> {
  for (const encoding of DETECT_ENCODINGS) {
    const text = await decodeFile(file, encoding);
    const headerLine = text.split(/\r\n|\n|\r/).find((l) => l.trim())?.trim();
    if (!headerLine) continue;
    const parser = parsers.find((p) => p.matches(headerLine));
    if (parser) return parser;
  }
  return null;
}

export type {
  CsvParser,
  ParsedTransaction,
  ColumnMapping,
  CsvEncoding,
  CsvDelimiter,
  DateFormat,
  NumberFormat,
} from "./types";
export { normalizeAccountNumber } from "./utils";
export { resolveRows } from "./resolve-rows";
export type { ImportableRow, ResolveResult } from "./resolve-rows";
export { decodeFile, detectDelimiter, splitRows } from "./parse-table";
export { parseAmount, parseDate } from "./format-helpers";
export {
  parseWithMapping,
  buildDefaultMapping,
  validateMapping,
} from "./generic";
export type {
  MappingValidationError,
  ParseDiagnostics,
  ParseResult,
} from "./generic";
