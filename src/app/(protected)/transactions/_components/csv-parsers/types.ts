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
