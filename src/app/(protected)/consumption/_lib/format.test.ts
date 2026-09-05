import { describe, expect, it } from "vitest";

import {
  formatChangePct,
  formatDelta,
  formatNumber,
  formatQuantity,
  formatQuantityInput,
  formatReadingDate,
  formatUnit,
  monthCellState,
  parseQuantityInput,
  perDayDecimals,
  percentChange,
} from "./format";

describe("formatUnit", () => {
  it("normalises cubic metres and trims", () => {
    expect(formatUnit("m3")).toBe("m³");
    expect(formatUnit("M^3")).toBe("m³");
    expect(formatUnit(" GJ ")).toBe("GJ");
    expect(formatUnit("kWh")).toBe("kWh");
    expect(formatUnit("")).toBe("");
  });
});

describe("formatQuantity / formatNumber", () => {
  it("renders Danish grouping and the meter's decimals", () => {
    expect(formatQuantity(1_234_567, 3, "kWh")).toBe("1.234,567 kWh");
    expect(formatQuantity(1_234_567, 0, "kWh")).toBe("1.235 kWh");
    expect(formatQuantity(1_234_567, 1, "m³")).toBe("1.234,6 m³");
    expect(formatQuantity(0, 2, "m³")).toBe("0,00 m³");
    expect(formatQuantity(123_456_789_012, 0, "kWh")).toBe("123.456.789 kWh");
  });

  it("omits the unit when empty and uses a real minus", () => {
    expect(formatQuantity(500, 1, "")).toBe("0,5");
    expect(formatNumber(-12_000, 1)).toBe("−12,0");
  });
});

describe("formatDelta / formatChangePct / percentChange", () => {
  it("formats deltas with an em dash for unknown", () => {
    expect(formatDelta(null, 0, "kWh")).toBe("—");
    expect(formatDelta(0, 0, "kWh")).toBe("0 kWh");
    expect(formatDelta(-12_000, 1, "kWh")).toBe("−12,0 kWh");
    expect(formatDelta(234_000, 0, "kWh")).toBe("234 kWh");
  });

  it("rounds percentages with explicit sign", () => {
    expect(formatChangePct(12.4)).toBe("+12%");
    expect(formatChangePct(-8.6)).toBe("−9%");
    expect(formatChangePct(0.2)).toBe("0%");
    expect(formatChangePct(null)).toBe("—");
  });

  it("percentChange guards against missing or zero baselines", () => {
    expect(percentChange(90, 100)).toBeCloseTo(-10);
    expect(percentChange(90, 0)).toBeNull();
    expect(percentChange(90, null)).toBeNull();
  });
});

describe("formatQuantityInput", () => {
  it("keeps stored precision without grouping", () => {
    expect(formatQuantityInput(1_234_567, 1)).toBe("1234,567");
    expect(formatQuantityInput(1_234_000, 1)).toBe("1234,0");
    expect(formatQuantityInput(1_234_000, 0)).toBe("1234");
  });
});

describe("parseQuantityInput", () => {
  it("accepts Danish, plain and grouped input", () => {
    expect(parseQuantityInput("1.234,567")).toBe(1_234_567);
    expect(parseQuantityInput("1234.567")).toBe(1_234_567);
    expect(parseQuantityInput("1234,5")).toBe(1_234_500);
    expect(parseQuantityInput("1 234,5")).toBe(1_234_500);
    expect(parseQuantityInput("12.345.678")).toBe(12_345_678_000);
    expect(parseQuantityInput(" 42 ")).toBe(42_000);
    expect(parseQuantityInput("0")).toBe(0);
  });

  it("rounds beyond three decimals and passes negatives through", () => {
    expect(parseQuantityInput("1,2345")).toBe(1_235);
    expect(parseQuantityInput("-5")).toBe(-5_000);
  });

  it("rejects garbage", () => {
    expect(parseQuantityInput("")).toBeNull();
    expect(parseQuantityInput("abc")).toBeNull();
    expect(parseQuantityInput("1,2,3")).toBeNull();
    expect(parseQuantityInput("1.234,56,7")).toBeNull();
    expect(parseQuantityInput("12..3")).toBeNull();
    expect(parseQuantityInput("12.34,5")).toBeNull();
    expect(parseQuantityInput("1234,")).toBeNull();
  });
});

describe("misc", () => {
  it("perDayDecimals never drops below one", () => {
    expect(perDayDecimals(0)).toBe(1);
    expect(perDayDecimals(3)).toBe(3);
  });

  it("formatReadingDate follows locale", () => {
    expect(formatReadingDate("2026-09-03", "da")).toBe("3. sep. 2026");
    expect(formatReadingDate("2026-09-03", "en")).toBe("3 Sep 2026");
  });

  it("monthCellState", () => {
    expect(
      monthCellState({ consumption: null, coveredDays: 0, daysInMonth: 31 }),
    ).toBe("none");
    expect(
      monthCellState({ consumption: 0, coveredDays: 0, daysInMonth: 31 }),
    ).toBe("none");
    expect(
      monthCellState({ consumption: 10, coveredDays: 12, daysInMonth: 31 }),
    ).toBe("partial");
    expect(
      monthCellState({ consumption: 10, coveredDays: 31, daysInMonth: 31 }),
    ).toBe("complete");
  });
});
