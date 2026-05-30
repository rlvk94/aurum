import { describe, expect, it } from "vitest";

import { sanitizeBankText } from "./sanitize";

describe("sanitizeBankText", () => {
  it("strips card prefix + trailing tail and date, keeps merchant + location", () => {
    expect(sanitizeBankText("DK KORT NETTO HØRSHOLM 1234 28.05")).toBe(
      "Netto Hørsholm",
    );
  });

  it("strips Visa/Dankort prefixes", () => {
    expect(sanitizeBankText("Visa/Dankort REMA 1000 LYNGBY")).toBe(
      "Rema 1000 Lyngby",
    );
    expect(sanitizeBankText("DANKORT-NOTA FØTEX CITY 27-05-2026")).toBe(
      "Føtex City",
    );
  });

  it("strips the MobilePay channel word but keeps the recipient", () => {
    expect(sanitizeBankText("MobilePay Anders Andersen 28.05")).toBe(
      "Anders Andersen",
    );
  });

  it("preserves a brand number in the protected second slot (Rema 1000)", () => {
    expect(sanitizeBankText("REMA 1000")).toBe("Rema 1000");
    expect(sanitizeBankText("REMA 1000 LYNGBY 5512 28.05.2024")).toBe(
      "Rema 1000 Lyngby",
    );
  });

  it("strips trailing dates in several formats", () => {
    expect(sanitizeBankText("Netto 2026-05-28")).toBe("Netto");
    expect(sanitizeBankText("Netto 28/05")).toBe("Netto");
    expect(sanitizeBankText("Netto den 28.05")).toBe("Netto");
  });

  it("strips trailing reference markers and long ids", () => {
    expect(sanitizeBankText("Telia Ref 998877")).toBe("Telia");
    expect(sanitizeBankText("Forsikring Nota 4521")).toBe("Forsikring");
  });

  it("applies brand-casing exceptions", () => {
    expect(sanitizeBankText("H&M MAGASIN")).toBe("H&M Magasin");
    expect(sanitizeBankText("OK BENZIN")).toBe("OK Benzin");
    expect(sanitizeBankText("IKEA TAASTRUP")).toBe("IKEA Taastrup");
  });

  it("falls back to the title-cased original for pure transfer/channel text", () => {
    expect(sanitizeBankText("Overførsel")).toBe("Overførsel");
    expect(sanitizeBankText("STRAKSOVERFØRSEL")).toBe("Straksoverførsel");
  });

  it("is idempotent on already-clean text", () => {
    const once = sanitizeBankText("DK KORT NETTO HØRSHOLM 1234 28.05");
    expect(sanitizeBankText(once)).toBe(once);
    expect(sanitizeBankText("Netto Hørsholm")).toBe("Netto Hørsholm");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeBankText("")).toBe("");
    expect(sanitizeBankText("   ")).toBe("");
  });

  it("collapses whitespace", () => {
    expect(sanitizeBankText("  NETTO    HØRSHOLM  ")).toBe("Netto Hørsholm");
  });
});
