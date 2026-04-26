import type { CsvDelimiter, CsvEncoding } from "./types";
import { parseLine } from "./utils";

/** Read a file using the given encoding. */
export async function decodeFile(
  file: File,
  encoding: CsvEncoding,
): Promise<string> {
  const buffer = await file.arrayBuffer();
  return new TextDecoder(encoding).decode(buffer);
}

/**
 * Pick the most plausible delimiter from the first non-empty line by
 * counting candidates outside quoted spans.
 */
export function detectDelimiter(firstLine: string): CsvDelimiter {
  const candidates: CsvDelimiter[] = [";", ",", "\t", "|"];
  let best: CsvDelimiter = ";";
  let bestCount = -1;
  for (const delim of candidates) {
    const count = countOutsideQuotes(firstLine, delim);
    if (count > bestCount) {
      best = delim;
      bestCount = count;
    }
  }
  return best;
}

function countOutsideQuotes(line: string, delim: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      count++;
    }
  }
  return count;
}

/** Split text into rows × columns using the given delimiter. */
export function splitRows(text: string, delimiter: CsvDelimiter): string[][] {
  return text
    .split(/\r\n|\n|\r/)
    .filter((l) => l.length > 0)
    .map((line) => parseLine(line, delimiter));
}
