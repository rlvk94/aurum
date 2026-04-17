import { describe, it, expect } from "vitest";
import { computePeriodWindow } from "~/server/lib/challenge-period";

describe("computePeriodWindow", () => {
  describe("one_off", () => {
    it("returns the fixed start and end dates", () => {
      expect(
        computePeriodWindow("one_off", "2026-04-01", "2026-04-30", null, "2026-04-15"),
      ).toEqual({ from: "2026-04-01", to: "2026-04-30" });
    });
  });

  describe("weekly", () => {
    it("returns the first week when asOf is within it", () => {
      expect(
        computePeriodWindow("weekly", "2026-04-01", null, null, "2026-04-03"),
      ).toEqual({ from: "2026-04-01", to: "2026-04-07" });
    });

    it("rolls into the next week on day 8", () => {
      expect(
        computePeriodWindow("weekly", "2026-04-01", null, null, "2026-04-08"),
      ).toEqual({ from: "2026-04-08", to: "2026-04-14" });
    });

    it("handles asOf before startDate by anchoring to the first period", () => {
      expect(
        computePeriodWindow("weekly", "2026-04-10", null, null, "2026-04-01"),
      ).toEqual({ from: "2026-04-10", to: "2026-04-16" });
    });
  });

  describe("custom", () => {
    it("uses customDurationDays for the stride", () => {
      expect(
        computePeriodWindow("custom", "2026-04-01", null, 10, "2026-04-05"),
      ).toEqual({ from: "2026-04-01", to: "2026-04-10" });
      expect(
        computePeriodWindow("custom", "2026-04-01", null, 10, "2026-04-11"),
      ).toEqual({ from: "2026-04-11", to: "2026-04-20" });
    });

    it("throws when customDurationDays missing", () => {
      expect(() =>
        computePeriodWindow("custom", "2026-04-01", null, null, "2026-04-05"),
      ).toThrow();
    });
  });

  describe("monthly", () => {
    it("returns first month anchored on startDate", () => {
      expect(
        computePeriodWindow("monthly", "2026-04-15", null, null, "2026-04-20"),
      ).toEqual({ from: "2026-04-15", to: "2026-05-14" });
    });

    it("rolls to the next anchored month after periodEnd", () => {
      expect(
        computePeriodWindow("monthly", "2026-04-15", null, null, "2026-05-20"),
      ).toEqual({ from: "2026-05-15", to: "2026-06-14" });
    });

    it("clamps end-of-month anchors so periods don't drift past short months", () => {
      // Jan-31 monthly: period 0 ends the day before the next anchor (Feb 28).
      expect(
        computePeriodWindow("monthly", "2026-01-31", null, null, "2026-02-15"),
      ).toEqual({ from: "2026-01-31", to: "2026-02-27" });
      // Period 1 covers Feb 28 → Mar 30 (next anchor is re-clamped to Mar 31).
      expect(
        computePeriodWindow("monthly", "2026-01-31", null, null, "2026-03-01"),
      ).toEqual({ from: "2026-02-28", to: "2026-03-30" });
      // Period 2 re-anchors back to the 31st on a long month.
      expect(
        computePeriodWindow("monthly", "2026-01-31", null, null, "2026-04-15"),
      ).toEqual({ from: "2026-03-31", to: "2026-04-29" });
    });
  });

  describe("yearly", () => {
    it("returns first year anchored on startDate", () => {
      expect(
        computePeriodWindow("yearly", "2026-04-15", null, null, "2026-10-01"),
      ).toEqual({ from: "2026-04-15", to: "2027-04-14" });
    });

    it("rolls to the next year after periodEnd", () => {
      expect(
        computePeriodWindow("yearly", "2026-04-15", null, null, "2027-05-01"),
      ).toEqual({ from: "2027-04-15", to: "2028-04-14" });
    });
  });
});
