import type { CsvParser, ParsedTransaction } from "./types";
import {
  parseDanishAmount,
  parseDanishDate,
  parseLine,
  readFileAsText,
} from "./utils";

/**
 * Parser for Danish bank CSV exports (Jyske Bank / Sparekassen).
 *
 * Columns: Exportkonto; Afsenderkonto; Modtagerkonto; Dato; Tekst; Beløb; Saldo;
 *          Indbetaler; Supp. tekst til modtager; Tekst til modtager
 *
 * File is ISO-8859-1 encoded, semicolon-separated, Danish date and number format.
 */
export const danishBankParser: CsvParser = {
  id: "danish-bank",
  label: "Danish bank (Exportkonto format)",

  matches: (headerLine) => headerLine.toLowerCase().includes('"exportkonto"'),

  parse: async (file) => {
    const text = await readFileAsText(file, "iso-8859-1");
    const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);

    const rows: ParsedTransaction[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const fields = parseLine(line);
      if (fields.length < 10) continue;

      const exportAccount = (fields[0] ?? "").trim();
      const fromAccount = (fields[1] ?? "").trim();
      const toAccount = (fields[2] ?? "").trim();
      const date = parseDanishDate(fields[3] ?? "");
      const amount = parseDanishAmount(fields[5] ?? "");
      const balance = parseDanishAmount(fields[6] ?? "");

      if (!date || amount === null || balance === null) continue;

      // direction: outgoing when export is the sender (or amount negative and no sender set);
      // incoming when export is the receiver.
      const direction: "outgoing" | "incoming" =
        amount < 0 ? "outgoing" : "incoming";

      // Counter account is the "other side" of the transaction.
      const counterAccount =
        direction === "outgoing" ? toAccount : fromAccount;

      const payer = (fields[7] ?? "").trim();
      const suppText = (fields[8] ?? "").trim();

      const metadata: Record<string, string> = {};
      if (payer) metadata.payer = payer;
      if (suppText) metadata.suppText = suppText;

      rows.push({
        exportAccount,
        counterAccount,
        direction,
        date,
        description: (fields[4] ?? "").trim(),
        amount,
        balance,
        note: (fields[9] ?? "").trim(),
        metadata,
      });
    }

    return rows;
  },
};
