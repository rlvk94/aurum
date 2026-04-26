import { describe, expect, it } from "vitest";
import { decodeFile, detectDelimiter, splitRows } from "./parse-table";

describe("detectDelimiter", () => {
  it("picks the most frequent delimiter outside quotes", () => {
    expect(detectDelimiter("a;b;c;d")).toBe(";");
    expect(detectDelimiter("a,b,c,d")).toBe(",");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(detectDelimiter("a|b|c|d|e")).toBe("|");
  });

  it("ignores delimiters inside quoted spans", () => {
    expect(detectDelimiter('"a;b";c;d')).toBe(";");
    expect(detectDelimiter('"a,b,c",d,e,f')).toBe(",");
  });
});

describe("splitRows", () => {
  it("parses comma-delimited rows with quoted fields", () => {
    const text = 'Date,Description,Amount\n2024-01-15,"Hello, world",100.00';
    expect(splitRows(text, ",")).toEqual([
      ["Date", "Description", "Amount"],
      ["2024-01-15", "Hello, world", "100.00"],
    ]);
  });

  it("handles CRLF line endings", () => {
    const text = "a;b\r\nc;d\r\n";
    expect(splitRows(text, ";")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("decodeFile", () => {
  it("round-trips UTF-8 with diacritics", async () => {
    const blob = new Blob([new TextEncoder().encode("dato;tekst\n2024-01-01;Smørrebrød")], {
      type: "text/csv",
    });
    const file = new File([blob], "x.csv");
    const text = await decodeFile(file, "utf-8");
    expect(text).toContain("Smørrebrød");
  });

  it("decodes ISO-8859-1 bytes correctly", async () => {
    // "Smørrebrød" in ISO-8859-1: ø=0xF8, å=0xE5
    const bytes = new Uint8Array([
      0x53, 0x6d, 0xf8, 0x72, 0x72, 0x65, 0x62, 0x72, 0xf8, 0x64,
    ]);
    const file = new File([bytes], "x.csv");
    const text = await decodeFile(file, "iso-8859-1");
    expect(text).toBe("Smørrebrød");
  });
});
