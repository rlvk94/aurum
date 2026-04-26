/**
 * Parsed transaction from a CSV file, normalized across bank formats.
 * - amount is signed cents (negative = debit, positive = credit)
 * - date is ISO YYYY-MM-DD
 * - account numbers should be raw strings; callers normalize for matching
 */
export type ParsedTransaction = {
  /** The account the CSV was exported from (always present). */
  exportAccount: string;
  /** The other side of the transaction (may be empty). */
  counterAccount: string;
  /** Whether this row represents money leaving (outgoing) or entering (incoming) the exportAccount. */
  direction: "outgoing" | "incoming";
  date: string;
  description: string;
  /** Signed amount in cents (matches the bank's sign convention from the exportAccount's perspective). */
  amount: number;
  /** Running balance in cents after the transaction. Used as part of the deduplication key. */
  balance: number;
  /** Optional user-facing note / supplementary text from the bank. */
  note: string;
  /**
   * Extra fields from the source (e.g. payer info, supplementary text).
   * Stored on the transaction but not shown in the UI.
   * Used to widen the search text for categorization rules.
   */
  metadata: Record<string, string>;
  /**
   * Optional pre-computed dedup key. The generic mapping flow uses this when
   * a CSV has no balance column, falling back to a row-index-based key so
   * re-importing the same file dedups. When omitted, resolveRows computes
   * `${date}:${amount}:${balance}` itself.
   */
  externalId?: string;
};

export type CsvParser = {
  /** Unique identifier for this parser (for logs/debugging). */
  id: string;
  /** Human-readable label. */
  label: string;
  /**
   * Returns true if this parser can handle the given header line.
   * Called on the first non-empty line of the decoded file.
   */
  matches: (headerLine: string) => boolean;
  /**
   * Decodes and parses the file into transactions.
   */
  parse: (file: File) => Promise<ParsedTransaction[]>;
};

/** Date formats the generic mapping flow knows how to parse. */
export type DateFormat =
  | "yyyy-MM-dd"
  | "dd-MM-yyyy"
  | "dd/MM/yyyy"
  | "MM/dd/yyyy"
  | "yyyy/MM/dd"
  | "dd.MM.yyyy"
  | "yyyy.MM.dd";

/** Encodings offered to the user in the mapping flow. */
export type CsvEncoding = "utf-8" | "iso-8859-1" | "windows-1252";

/** CSV delimiters offered to the user in the mapping flow. */
export type CsvDelimiter = ";" | "," | "\t" | "|";

export type NumberFormat = "comma-decimal" | "dot-decimal";

/**
 * User-supplied mapping for a generic CSV. The mapping step in the import
 * dialog builds one of these from the file's headers and column previews;
 * `parseWithMapping` then turns it into ParsedTransaction[].
 */
export type ColumnMapping = {
  encoding: CsvEncoding;
  delimiter: CsvDelimiter;
  hasHeader: boolean;
  dateColumn: number;
  dateFormat: DateFormat;
  descriptionColumn: number;
  amountMode: "signed" | "split";
  /** Required when amountMode === "signed". */
  amountColumn?: number;
  /** Required when amountMode === "split". */
  debitColumn?: number;
  /** Required when amountMode === "split". */
  creditColumn?: number;
  numberFormat: NumberFormat;
  exportAccountColumn: number;
  counterAccountColumn?: number;
  noteColumn?: number;
  balanceColumn?: number;
};
