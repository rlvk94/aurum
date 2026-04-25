import { describe, it, expect } from "vitest";
import { deriveProgress, formatAmount } from "./format";

describe("deriveProgress", () => {
  it("returns no_dates when neither startDate nor endDate set", () => {
    const r = deriveProgress({
      startDate: null,
      endDate: null,
      spendingLimit: null,
      net: 5000,
    });
    expect(r.status).toBe("no_dates");
    expect(r.elapsedFraction).toBeNull();
    expect(r.isOnTrack).toBeNull();
  });

  it("returns not_started before startDate", () => {
    const r = deriveProgress({
      startDate: "2026-12-01",
      endDate: "2026-12-15",
      spendingLimit: null,
      net: 0,
      asOfIso: "2026-04-25",
    });
    expect(r.status).toBe("not_started");
    expect(r.daysToStart).toBeGreaterThan(0);
  });

  it("returns active mid-period and computes elapsedFraction", () => {
    const r = deriveProgress({
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      spendingLimit: 100_000,
      net: 50_000,
      asOfIso: "2026-04-15",
    });
    expect(r.status).toBe("active");
    expect(r.elapsedFraction).not.toBeNull();
    expect(r.elapsedFraction!).toBeGreaterThan(0.4);
    expect(r.elapsedFraction!).toBeLessThan(0.6);
    expect(r.limitFraction).toBeCloseTo(0.5, 5);
    expect(r.isOnTrack).toBe(true);
  });

  it("returns over when net exceeds spending limit", () => {
    const r = deriveProgress({
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      spendingLimit: 10_000,
      net: 12_000,
      asOfIso: "2026-04-15",
    });
    expect(r.status).toBe("over");
    expect(r.limitFraction!).toBeGreaterThan(1);
  });

  it("returns met when ended within limit", () => {
    const r = deriveProgress({
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      spendingLimit: 100_000,
      net: 80_000,
      asOfIso: "2026-05-10",
    });
    expect(r.status).toBe("met");
  });

  it("returns ended when no limit and past endDate", () => {
    const r = deriveProgress({
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      spendingLimit: null,
      net: 80_000,
      asOfIso: "2026-05-10",
    });
    expect(r.status).toBe("ended");
    expect(r.daysSinceEnd).toBeGreaterThan(0);
  });

  it("flags off-track when spend pace exceeds time pace", () => {
    const r = deriveProgress({
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      spendingLimit: 100_000,
      net: 80_000,
      asOfIso: "2026-04-05",
    });
    expect(r.status).toBe("active");
    expect(r.isOnTrack).toBe(false);
  });
});

describe("formatAmount", () => {
  it("formats positive cents to da-DK locale with kr suffix", () => {
    // Danish locale uses period as group separator; expected: 14.250 kr.
    const formatted = formatAmount(1_425_000);
    expect(formatted).toMatch(/14\.250 kr\./);
  });

  it("renders a leading minus for negatives", () => {
    const formatted = formatAmount(-486_00);
    expect(formatted.startsWith("-")).toBe(true);
  });

  it("respects 2-decimal mode", () => {
    const formatted = formatAmount(1234, { decimals: 2 });
    expect(formatted).toContain("12,34");
  });
});
