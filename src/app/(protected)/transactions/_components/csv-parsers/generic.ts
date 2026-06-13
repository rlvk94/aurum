import { parseAmount, parseDate } from "./format-helpers";
import type { ColumnMapping, ParsedTransaction } from "./types";

export type ParseDiagnostics = {
  totalRows: number;
  produced: number;
  droppedInvalidDate: number;
  droppedInvalidAmount: number;
  droppedZeroAmount: number;
  /** First raw value that failed to parse as a date, for surfacing in UI. */
  sampleInvalidDate?: string;
  /** First raw amount string (or "debit | credit" pair) that failed to parse. */
  sampleInvalidAmount?: string;
};

export type ParseResult = {
  rows: ParsedTransaction[];
  diagnostics: ParseDiagnostics;
};

/**
 * Convert a tabular CSV (already split into rows × columns) into normalized
 * transactions using a user-supplied column mapping.
 *
 * Rows with unparseable date or amount are dropped. In split mode, a row
 * with both debit and credit zero is dropped as well. The returned
 * diagnostics object explains why rows were dropped so the UI can show a
 * targeted error instead of a generic "format not supported" message.
 *
 * If the mapping has no balance column, the externalId falls back to
 * `${date}:${signedAmount}:row${index}` so re-importing the same file in
 * the same row order dedups, but the importer can't tell two real
 * transactions with identical date+amount apart from a duplicate row.
 */
export function parseWithMapping(
  table: string[][],
  mapping: ColumnMapping,
): ParseResult {
  const startIndex = mapping.hasHeader ? 1 : 0;
  const headers = mapping.hasHeader && table.length > 0 ? (table[0] ?? []) : [];

  const mappedColumnIndices = new Set<number>();
  const addMapped = (idx: number | undefined) => {
    if (typeof idx === "number") mappedColumnIndices.add(idx);
  };
  addMapped(mapping.dateColumn);
  addMapped(mapping.descriptionColumn);
  addMapped(mapping.amountColumn);
  addMapped(mapping.debitColumn);
  addMapped(mapping.creditColumn);
  addMapped(mapping.exportAccountColumn);
  addMapped(mapping.counterAccountColumn);
  addMapped(mapping.noteColumn);
  addMapped(mapping.balanceColumn);

  const rows: ParsedTransaction[] = [];
  const diagnostics: ParseDiagnostics = {
    totalRows: 0,
    produced: 0,
    droppedInvalidDate: 0,
    droppedInvalidAmount: 0,
    droppedZeroAmount: 0,
  };

  for (let i = startIndex; i < table.length; i++) {
    const row = table[i];
    if (!row) continue;
    diagnostics.totalRows++;

    const rawDate = row[mapping.dateColumn] ?? "";
    const date = parseDate(rawDate, mapping.dateFormat);
    if (!date) {
      diagnostics.droppedInvalidDate++;
      if (!diagnostics.sampleInvalidDate && rawDate.trim()) {
        diagnostics.sampleInvalidDate = rawDate.trim();
      }
      continue;
    }

    let signedAmount: number | null = null;
    let rawAmountSample = "";
    if (mapping.amountMode === "signed") {
      if (mapping.amountColumn === undefined) continue;
      rawAmountSample = (row[mapping.amountColumn] ?? "").trim();
      signedAmount = parseAmount(
        row[mapping.amountColumn] ?? "",
        mapping.numberFormat,
      );
    } else {
      if (
        mapping.debitColumn === undefined ||
        mapping.creditColumn === undefined
      ) {
        continue;
      }
      const rawDebit = (row[mapping.debitColumn] ?? "").trim();
      const rawCredit = (row[mapping.creditColumn] ?? "").trim();
      rawAmountSample = `${rawDebit} | ${rawCredit}`;
      const debit = parseAmount(rawDebit, mapping.numberFormat);
      const credit = parseAmount(rawCredit, mapping.numberFormat);
      const debitAbs = debit ? Math.abs(debit) : 0;
      const creditAbs = credit ? Math.abs(credit) : 0;
      if (debitAbs > 0) {
        signedAmount = -debitAbs;
      } else if (creditAbs > 0) {
        signedAmount = creditAbs;
      }
    }
    if (signedAmount === null) {
      diagnostics.droppedInvalidAmount++;
      if (!diagnostics.sampleInvalidAmount && rawAmountSample) {
        diagnostics.sampleInvalidAmount = rawAmountSample;
      }
      continue;
    }
    if (signedAmount === 0) {
      diagnostics.droppedZeroAmount++;
      continue;
    }

    const balance =
      mapping.balanceColumn !== undefined
        ? parseAmount(row[mapping.balanceColumn] ?? "", mapping.numberFormat)
        : null;

    const exportAccount = (row[mapping.exportAccountColumn] ?? "").trim();
    const counterAccount =
      mapping.counterAccountColumn !== undefined
        ? (row[mapping.counterAccountColumn] ?? "").trim()
        : "";
    const description = (row[mapping.descriptionColumn] ?? "").trim();
    const note =
      mapping.noteColumn !== undefined
        ? (row[mapping.noteColumn] ?? "").trim()
        : "";

    const metadata: Record<string, string> = {};
    if (mapping.hasHeader) {
      for (let c = 0; c < row.length; c++) {
        if (mappedColumnIndices.has(c)) continue;
        const value = (row[c] ?? "").trim();
        if (!value) continue;
        const header = (headers[c] ?? `column${c}`).trim() || `column${c}`;
        metadata[header] = value;
      }
    }

    const direction: "outgoing" | "incoming" =
      signedAmount < 0 ? "outgoing" : "incoming";

    const externalId =
      balance !== null
        ? `${date}:${signedAmount}:${balance}`
        : `${date}:${signedAmount}:row${i}`;

    rows.push({
      exportAccount,
      counterAccount,
      direction,
      date,
      description,
      amount: signedAmount,
      balance: balance ?? 0,
      note,
      metadata,
      externalId,
    });
  }

  diagnostics.produced = rows.length;
  return { rows, diagnostics };
}

/**
 * Build a sensible default mapping from a freshly parsed table. Tries to
 * match column headers (when present) against common bank CSV terms in
 * Danish and English. Falls back to first / second / etc. columns when no
 * match is found, but leaves required fields undefined-equivalent (-1) so
 * the validation layer surfaces them.
 */
export function buildDefaultMapping(
  table: string[][],
  base: Pick<ColumnMapping, "encoding" | "delimiter">,
): ColumnMapping {
  const firstRow = table[0] ?? [];
  const looksLikeHeader = firstRow.some((cell) =>
    /[a-zA-Zæøåäöü]/.test(cell ?? ""),
  );
  const headers = looksLikeHeader
    ? firstRow.map((h) => h.trim().toLowerCase())
    : [];

  const findCol = (patterns: RegExp[]): number | undefined => {
    if (!headers.length) return undefined;
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i] ?? "";
      if (patterns.some((p) => p.test(h))) return i;
    }
    return undefined;
  };

  const dateColumn = findCol([/dato/, /date/]) ?? 0;
  const descriptionColumn =
    findCol([/tekst/, /description/, /text/, /narrative/, /detail/]) ?? 1;
  const amountColumn = findCol([/beløb/, /amount/, /value/]);
  const debitColumn = findCol([/debit|withdrawal|hævet|udgift/]);
  const creditColumn = findCol([/credit|deposit|indsat|indtægt/]);
  const balanceColumn = findCol([/saldo|balance/]);
  const exportAccountColumn =
    findCol([/exportkonto|account.*number|kontonr|konto$/]) ?? 0;
  const counterAccountColumn = findCol([
    /modtager|recipient|counter|fra.*konto|afsender/,
  ]);
  const noteColumn = findCol([/note|memo|reference|tekst.*modtager/]);

  const amountMode: "signed" | "split" =
    amountColumn === undefined &&
    debitColumn !== undefined &&
    creditColumn !== undefined
      ? "split"
      : "signed";

  return {
    encoding: base.encoding,
    delimiter: base.delimiter,
    hasHeader: looksLikeHeader,
    dateColumn,
    dateFormat: "yyyy-MM-dd",
    descriptionColumn,
    amountMode,
    amountColumn: amountMode === "signed" ? amountColumn : undefined,
    debitColumn: amountMode === "split" ? debitColumn : undefined,
    creditColumn: amountMode === "split" ? creditColumn : undefined,
    numberFormat: "comma-decimal",
    exportAccountColumn,
    counterAccountColumn,
    noteColumn,
    balanceColumn,
  };
}

export type MappingValidationError =
  | "amountColumnRequired"
  | "debitCreditRequired"
  | "duplicateColumns";

/**
 * Returns a list of validation errors keyed for translation. Empty array
 * means the mapping can be used to parse the file.
 */
export function validateMapping(
  mapping: ColumnMapping,
): MappingValidationError[] {
  const errors: MappingValidationError[] = [];

  if (mapping.amountMode === "signed") {
    if (mapping.amountColumn === undefined) errors.push("amountColumnRequired");
  } else {
    if (
      mapping.debitColumn === undefined ||
      mapping.creditColumn === undefined ||
      mapping.debitColumn === mapping.creditColumn
    ) {
      errors.push("debitCreditRequired");
    }
  }

  const hardMapped: number[] = [
    mapping.dateColumn,
    mapping.descriptionColumn,
    mapping.exportAccountColumn,
  ];
  if (mapping.amountMode === "signed" && mapping.amountColumn !== undefined) {
    hardMapped.push(mapping.amountColumn);
  }
  if (mapping.amountMode === "split") {
    if (mapping.debitColumn !== undefined) hardMapped.push(mapping.debitColumn);
    if (mapping.creditColumn !== undefined)
      hardMapped.push(mapping.creditColumn);
  }
  const seen = new Set<number>();
  for (const c of hardMapped) {
    if (seen.has(c)) {
      errors.push("duplicateColumns");
      break;
    }
    seen.add(c);
  }

  return errors;
}
