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

  it("strips colon-separated channel prefixes", () => {
    expect(sanitizeBankText("Forretning: Proton")).toBe("Proton");
    expect(sanitizeBankText("Mobilepay: Nrgi Elhan")).toBe("Nrgi Elhan");
    // "Sp" is a merchant abbreviation, not noise — it is kept.
    expect(sanitizeBankText("Forretning: Sp Juleeventyr")).toBe(
      "Sp Juleeventyr",
    );
  });

  it("strips a leading reference/contract number after a channel word", () => {
    expect(sanitizeBankText("Ydelse 0111261 Boliglån")).toBe("Boliglån");
  });

  it("strips a stacked card + embedded MobilePay (asterisk) prefix", () => {
    expect(sanitizeBankText("Kort Dk Mob.pay*rejsekort")).toBe("Rejsekort");
  });

  it("strips trailing country codes", () => {
    expect(sanitizeBankText("Forretning: Thomann De Dk")).toBe("Thomann");
  });

  it("strips the reversed 'Køb kort DK' card prefix", () => {
    expect(sanitizeBankText("Køb kort DK NETTO HASLEV")).toBe("Netto Haslev");
    expect(sanitizeBankText("KØB KORT DK AURUM")).toBe("Aurum");
  });

  it("repairs 'ø' mangled to '@' inside a word", () => {
    expect(sanitizeBankText("Køb kort DK REMA 1000 R@NNE")).toBe(
      "Rema 1000 Rønne",
    );
    expect(sanitizeBankText("Køb kort DK R@NNEDE APOTEK")).toBe(
      "Rønnede Apotek",
    );
  });

  it("splits a store code glued between a brand and a location", () => {
    expect(sanitizeBankText("Køb kort DK LIDL225HASLEV")).toBe(
      "Lidl 225 Haslev",
    );
  });

  it("strips a glued/spaced DK-NOTA reference prefix and a trailing slash", () => {
    expect(sanitizeBankText("DK-NOTA52017 ZINKBAKKEN.DK/")).toBe(
      "Zinkbakken.dk",
    );
    expect(sanitizeBankText("DK-NOTAf145d SAXO.COM")).toBe("Saxo.com");
    expect(sanitizeBankText("DK-NOTAC3414 GRUSDIREKTE APS")).toBe(
      "Grusdirekte Aps",
    );
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
