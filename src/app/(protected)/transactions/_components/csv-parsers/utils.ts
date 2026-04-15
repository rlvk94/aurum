/**
 * Parses one CSV line with semicolon separators, handling quoted fields.
 */
export function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ";" && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/** Parse Danish date "DD-MM-YYYY" to ISO "YYYY-MM-DD". */
export function parseDanishDate(s: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s.trim());
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Parse Danish number "1.234,56" or "-170,00" to cents integer. */
export function parseDanishAmount(s: string): number | null {
  const cleaned = s.trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

/**
 * Normalize a Danish bank account number to canonical form.
 * Format: first 4 digits = reg nr, rest = account nr possibly zero-padded to 10 digits.
 * Example: "53190334384" and "53190000334384" → both normalize to "5319-334384"
 */
export function normalizeAccountNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 5) return digits;
  const reg = digits.slice(0, 4);
  const rest = digits.slice(4).replace(/^0+/, "") || "0";
  return `${reg}-${rest}`;
}

/**
 * Read a file as text using the given encoding (default: UTF-8).
 */
export async function readFileAsText(
  file: File,
  encoding = "utf-8",
): Promise<string> {
  const buffer = await file.arrayBuffer();
  return new TextDecoder(encoding).decode(buffer);
}
