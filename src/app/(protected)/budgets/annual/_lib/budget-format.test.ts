import { describe, expect, it } from "vitest";
import {
  defaultCopyName,
  expectedProgressFractions,
  yearToDateStatus,
} from "./budget-format";

const monthly = (amount: number) => new Array<number>(12).fill(amount);

describe("expectedProgressFractions", () => {
  it("is all zeros before the budget year starts", () => {
    expect(expectedProgressFractions(2027, new Date(2026, 8, 5))).toEqual(
      new Array<number>(12).fill(0),
    );
  });

  it("is all ones after the budget year ended", () => {
    expect(expectedProgressFractions(2025, new Date(2026, 8, 5))).toEqual(
      new Array<number>(12).fill(1),
    );
  });

  it("pro-rates the current month by day", () => {
    // 15 Sep → Jan–Aug complete, Sep at 15/30, Oct–Dec untouched.
    const f = expectedProgressFractions(2026, new Date(2026, 8, 15));
    expect(f.slice(0, 8)).toEqual(new Array<number>(8).fill(1));
    expect(f[8]).toBeCloseTo(0.5);
    expect(f.slice(9)).toEqual([0, 0, 0]);
  });
});

describe("yearToDateStatus", () => {
  const now = new Date(2026, 8, 15); // 15 Sep 2026

  it("reports not_started for a future year", () => {
    expect(yearToDateStatus(monthly(1_000), 0, 2027, now)).toEqual({
      kind: "not_started",
    });
  });

  it("reports no_plan when nothing is planned or spent", () => {
    expect(yearToDateStatus(monthly(0), 0, 2026, now)).toEqual({
      kind: "no_plan",
    });
  });

  it("compares actuals to the pro-rated plan mid-year", () => {
    // 8.5 months of 1_000 → 8_500 planned to date.
    const status = yearToDateStatus(monthly(1_000), 8_000, 2026, now);
    expect(status).toEqual({
      kind: "under",
      phase: "in_progress",
      amount: 500,
      plannedToDate: 8_500,
    });
  });

  it("flags overspend against the pro-rated plan", () => {
    const status = yearToDateStatus(monthly(1_000), 9_200, 2026, now);
    expect(status).toEqual({
      kind: "over",
      phase: "in_progress",
      amount: 700,
      plannedToDate: 8_500,
    });
  });

  it("treats any spend against a zero plan as over", () => {
    const status = yearToDateStatus(monthly(0), 300, 2026, now);
    expect(status).toMatchObject({ kind: "over", amount: 300 });
  });

  it("uses the full-year plan once the year has ended", () => {
    const status = yearToDateStatus(monthly(1_000), 12_000, 2025, now);
    expect(status).toEqual({
      kind: "on_budget",
      phase: "ended",
      amount: 0,
      plannedToDate: 12_000,
    });
  });

  it("ignores months that have not started yet", () => {
    // Only December planned; nothing should count as due in September.
    const planned = monthly(0);
    planned[11] = 5_000;
    const status = yearToDateStatus(planned, 0, 2026, now);
    expect(status).toEqual({
      kind: "on_budget",
      phase: "in_progress",
      amount: 0,
      plannedToDate: 0,
    });
  });
});

describe("defaultCopyName", () => {
  it("swaps the source year when present", () => {
    expect(defaultCopyName("Husholdning 2026", 2026, 2027)).toBe(
      "Husholdning 2027",
    );
  });

  it("appends the target year when the name has no year", () => {
    expect(defaultCopyName("Husholdning", 2026, 2027)).toBe("Husholdning 2027");
  });

  it("only replaces the first occurrence and trims whitespace", () => {
    expect(defaultCopyName("  2026 plan 2026 ", 2026, 2027)).toBe(
      "2027 plan 2026",
    );
  });
});
