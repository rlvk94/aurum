import { describe, expect, it } from "vitest";
import { parseAmount, parseDate } from "./format-helpers";

describe("parseAmount", () => {
  it("parses Danish comma-decimal format", () => {
    expect(parseAmount("1.234,56", "comma-decimal")).toBe(123456);
    expect(parseAmount("-170,00", "comma-decimal")).toBe(-17000);
    expect(parseAmount("0,01", "comma-decimal")).toBe(1);
  });

  it("parses dot-decimal format", () => {
    expect(parseAmount("1,234.56", "dot-decimal")).toBe(123456);
    expect(parseAmount("-170.00", "dot-decimal")).toBe(-17000);
    expect(parseAmount("42", "dot-decimal")).toBe(4200);
  });

  it("ignores stray spaces used as thousand separators", () => {
    expect(parseAmount("1 234,56", "comma-decimal")).toBe(123456);
    expect(parseAmount("1 234.56", "dot-decimal")).toBe(123456);
  });

  it("returns null for unparseable input", () => {
    expect(parseAmount("", "comma-decimal")).toBeNull();
    expect(parseAmount("not a number", "comma-decimal")).toBeNull();
    expect(parseAmount("--1", "dot-decimal")).toBeNull();
  });
});

describe("parseDate", () => {
  it("parses each supported format", () => {
    expect(parseDate("2024-01-15", "yyyy-MM-dd")).toBe("2024-01-15");
    expect(parseDate("15-01-2024", "dd-MM-yyyy")).toBe("2024-01-15");
    expect(parseDate("15/01/2024", "dd/MM/yyyy")).toBe("2024-01-15");
    expect(parseDate("01/15/2024", "MM/dd/yyyy")).toBe("2024-01-15");
    expect(parseDate("2024/01/15", "yyyy/MM/dd")).toBe("2024-01-15");
    expect(parseDate("15.01.2024", "dd.MM.yyyy")).toBe("2024-01-15");
    expect(parseDate("2024.01.15", "yyyy.MM.dd")).toBe("2024-01-15");
  });

  it("accepts non-zero-padded day and month", () => {
    expect(parseDate("3/3/2026", "dd/MM/yyyy")).toBe("2026-03-03");
    expect(parseDate("3-3-2026", "dd-MM-yyyy")).toBe("2026-03-03");
    expect(parseDate("3.3.2026", "dd.MM.yyyy")).toBe("2026-03-03");
    expect(parseDate("2026-3-3", "yyyy-MM-dd")).toBe("2026-03-03");
    expect(parseDate("1/5/2024", "MM/dd/yyyy")).toBe("2024-01-05");
  });

  it("rejects mismatched format", () => {
    expect(parseDate("2024-01-15", "dd-MM-yyyy")).toBeNull();
    expect(parseDate("15/01/2024", "MM/dd/yyyy")).toBeNull();
  });

  it("rejects out-of-range months and days", () => {
    expect(parseDate("2024-13-01", "yyyy-MM-dd")).toBeNull();
    expect(parseDate("32-01-2024", "dd-MM-yyyy")).toBeNull();
  });

  it("returns null for empty/junk", () => {
    expect(parseDate("", "yyyy-MM-dd")).toBeNull();
    expect(parseDate("not a date", "yyyy-MM-dd")).toBeNull();
  });
});
