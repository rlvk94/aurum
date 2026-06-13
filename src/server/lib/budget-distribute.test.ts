import { describe, expect, it } from "vitest";
import {
  defaultStartMonth,
  distributeAmount,
  distributeByPeriod,
  periodsPerYear,
} from "./budget-distribute";

function sum(arr: number[]): number {
  return arr.reduce((acc, v) => acc + v, 0);
}

describe("periodsPerYear", () => {
  it("returns the expected count for each recurrence", () => {
    expect(periodsPerYear("monthly")).toBe(12);
    expect(periodsPerYear("quarterly")).toBe(4);
    expect(periodsPerYear("semi_annual")).toBe(2);
    expect(periodsPerYear("annual")).toBe(1);
    expect(periodsPerYear("custom")).toBe(1);
  });
});

describe("defaultStartMonth", () => {
  it("anchors each recurrence to its canonical slot", () => {
    expect(defaultStartMonth("monthly")).toBe(0);
    expect(defaultStartMonth("quarterly")).toBe(2);
    expect(defaultStartMonth("semi_annual")).toBe(5);
    expect(defaultStartMonth("annual")).toBe(11);
  });
});

describe("distributeAmount", () => {
  it("splits a monthly amount evenly", () => {
    const result = distributeAmount(12_000, "monthly");
    expect(result.every((v) => v === 1_000)).toBe(true);
    expect(sum(result)).toBe(12_000);
  });

  it("quarterly defaults to Mar/Jun/Sep/Dec", () => {
    const result = distributeAmount(4_000, "quarterly");
    expect(result[2]).toBe(1_000);
    expect(result[5]).toBe(1_000);
    expect(result[8]).toBe(1_000);
    expect(result[11]).toBe(1_000);
    expect(sum(result)).toBe(4_000);
  });

  it("quarterly with startMonth=0 lands on Jan/Apr/Jul/Oct", () => {
    const result = distributeAmount(4_000, "quarterly", 0);
    expect(result[0]).toBe(1_000);
    expect(result[3]).toBe(1_000);
    expect(result[6]).toBe(1_000);
    expect(result[9]).toBe(1_000);
    expect(sum(result)).toBe(4_000);
  });

  it("semi-annual startMonth=0 lands on Jan/Jul", () => {
    const result = distributeAmount(2_000, "semi_annual", 0);
    expect(result[0]).toBe(1_000);
    expect(result[6]).toBe(1_000);
    expect(sum(result)).toBe(2_000);
  });

  it("annual defaults to December and respects custom startMonth", () => {
    expect(distributeAmount(50_000, "annual")[11]).toBe(50_000);
    expect(distributeAmount(50_000, "annual", 5)[5]).toBe(50_000);
  });

  it("custom returns all zeros", () => {
    expect(distributeAmount(99_999, "custom")).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it("zero input across every recurrence returns zeros", () => {
    for (const r of [
      "monthly",
      "quarterly",
      "semi_annual",
      "annual",
      "custom",
    ] as const) {
      expect(distributeAmount(0, r)).toEqual([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ]);
    }
  });
});

describe("distributeByPeriod", () => {
  it("monthly: every month gets the period amount", () => {
    const result = distributeByPeriod(3_000, "monthly");
    expect(result.every((v) => v === 3_000)).toBe(true);
  });

  it("quarterly: four periods of the per-period amount", () => {
    const result = distributeByPeriod(2_500, "quarterly", 2);
    expect(result[2]).toBe(2_500);
    expect(result[5]).toBe(2_500);
    expect(result[8]).toBe(2_500);
    expect(result[11]).toBe(2_500);
    expect(sum(result)).toBe(10_000);
  });

  it("semi-annual with startMonth=0 lands on Jan + Jul", () => {
    const result = distributeByPeriod(6_000, "semi_annual", 0);
    expect(result[0]).toBe(6_000);
    expect(result[6]).toBe(6_000);
  });

  it("annual with startMonth=5 lands on June only", () => {
    const result = distributeByPeriod(10_000, "annual", 5);
    expect(result[5]).toBe(10_000);
    expect(sum(result)).toBe(10_000);
  });

  it("custom returns all zeros regardless of amount", () => {
    expect(distributeByPeriod(500, "custom")).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });
});
