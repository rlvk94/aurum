import { describe, expect, it } from "vitest";

import { computeOnTrack, daysBetween } from "./challenge-on-track";

describe("daysBetween", () => {
  it("counts whole days, sign-aware", () => {
    expect(daysBetween("2026-01-01", "2026-01-08")).toBe(7);
    expect(daysBetween("2026-01-08", "2026-01-01")).toBe(-7);
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
  });
});

describe("computeOnTrack", () => {
  const period = { periodStartIso: "2026-01-01", periodEndIso: "2026-01-10" };

  it("returns null before the period starts", () => {
    expect(
      computeOnTrack({
        type: "spend_less",
        ratio: 0,
        ...period,
        todayIso: "2025-12-31",
      }),
    ).toBeNull();
  });

  it("returns null after the period ends", () => {
    expect(
      computeOnTrack({
        type: "spend_less",
        ratio: 0.2,
        ...period,
        todayIso: "2026-01-11",
      }),
    ).toBeNull();
  });

  describe("spend_less: on track when spend ratio <= elapsed fraction (+1%)", () => {
    // Day 5 of a 10-day period → elapsedFrac = 5/10 = 0.5.
    it("on track when under pace", () => {
      expect(
        computeOnTrack({
          type: "spend_less",
          ratio: 0.4,
          ...period,
          todayIso: "2026-01-05",
        }),
      ).toBe(true);
    });

    it("off track when over pace", () => {
      expect(
        computeOnTrack({
          type: "spend_less",
          ratio: 0.8,
          ...period,
          todayIso: "2026-01-05",
        }),
      ).toBe(false);
    });

    it("tolerates a 1% buffer at the boundary", () => {
      // exactly at elapsedFrac 0.5 + 0.01 buffer
      expect(
        computeOnTrack({
          type: "spend_less",
          ratio: 0.51,
          ...period,
          todayIso: "2026-01-05",
        }),
      ).toBe(true);
      expect(
        computeOnTrack({
          type: "spend_less",
          ratio: 0.52,
          ...period,
          todayIso: "2026-01-05",
        }),
      ).toBe(false);
    });
  });

  describe("accumulating types: on track when ratio >= elapsed fraction (-1%)", () => {
    it("savings on track when ahead of pace", () => {
      expect(
        computeOnTrack({
          type: "savings",
          ratio: 0.6,
          ...period,
          todayIso: "2026-01-05",
        }),
      ).toBe(true);
    });

    it("savings off track when behind pace", () => {
      expect(
        computeOnTrack({
          type: "savings",
          ratio: 0.2,
          ...period,
          todayIso: "2026-01-05",
        }),
      ).toBe(false);
    });

    it("net_worth_goal uses the accumulating rule", () => {
      expect(
        computeOnTrack({
          type: "net_worth_goal",
          ratio: 0.49,
          ...period,
          todayIso: "2026-01-05",
        }),
      ).toBe(true); // 0.49 >= 0.5 - 0.01
      expect(
        computeOnTrack({
          type: "net_worth_goal",
          ratio: 0.48,
          ...period,
          todayIso: "2026-01-05",
        }),
      ).toBe(false);
    });
  });
});
