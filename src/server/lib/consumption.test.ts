import { describe, expect, it } from "vitest";

import {
  buildIntervals,
  bucketByMonth,
  clampDayOfMonth,
  copenhagenToday,
  daysBetween,
  daysInMonth,
  findLastCompleteMonth,
  isoWeekday,
  isReadingOverdue,
  isReminderDueToday,
  nextDueDate,
  previousDueDate,
  summarizeYears,
  validateReadingSequence,
  type ReadingLike,
  type ReminderSettings,
} from "./consumption";

function r(
  id: string,
  date: string,
  value: number,
  isMeterReset = false,
): ReadingLike {
  return { id, date, value, isMeterReset };
}

const monthly = (
  cadence: "monthly" | "weekly" = "monthly",
): ReminderSettings => ({
  enabled: true,
  cadence,
  dayOfMonth: 1,
  weekday: 1,
});

describe("date helpers", () => {
  it("daysBetween / daysInMonth / clampDayOfMonth", () => {
    expect(daysBetween("2026-01-01", "2026-02-01")).toBe(31);
    expect(daysBetween("2026-02-01", "2026-01-01")).toBe(-31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(clampDayOfMonth(2026, 2, 31)).toBe(28);
    expect(clampDayOfMonth(2026, 4, 31)).toBe(30);
    expect(clampDayOfMonth(2026, 1, 15)).toBe(15);
  });

  it("isoWeekday maps Sunday to 7", () => {
    expect(isoWeekday("2026-09-07")).toBe(1); // Monday
    expect(isoWeekday("2026-09-06")).toBe(7); // Sunday
  });

  it("copenhagenToday rolls over at local midnight, not UTC", () => {
    // CET (UTC+1) in March before DST switch: 23:30Z is 00:30 local next day.
    expect(copenhagenToday(new Date("2026-03-28T23:30:00Z"))).toBe(
      "2026-03-29",
    );
    // CEST (UTC+2) in July: 22:30Z is 00:30 local next day.
    expect(copenhagenToday(new Date("2026-07-01T22:30:00Z"))).toBe(
      "2026-07-02",
    );
    expect(copenhagenToday(new Date("2026-07-01T12:00:00Z"))).toBe(
      "2026-07-01",
    );
  });
});

describe("buildIntervals", () => {
  it("returns nothing for a single reading", () => {
    expect(buildIntervals([r("a", "2026-01-01", 1000)])).toEqual([]);
  });

  it("diffs consecutive readings and computes per-day rate", () => {
    const [iv] = buildIntervals([
      r("a", "2026-01-01", 10_000),
      r("b", "2026-02-01", 13_100),
    ]);
    expect(iv).toMatchObject({
      fromReadingId: "a",
      toReadingId: "b",
      days: 31,
      consumption: 3_100,
      perDay: 100,
    });
  });

  it("sorts readings given out of order", () => {
    const ivs = buildIntervals([
      r("c", "2026-03-01", 300),
      r("a", "2026-01-01", 100),
      r("b", "2026-02-01", 200),
    ]);
    expect(ivs.map((i) => i.toReadingId)).toEqual(["b", "c"]);
    expect(ivs.map((i) => i.consumption)).toEqual([100, 100]);
  });

  it("marks the interval ending at a reset reading as unknown", () => {
    const ivs = buildIntervals([
      r("a", "2026-01-01", 900_000),
      r("b", "2026-02-01", 5_000, true),
      r("c", "2026-03-01", 8_000),
    ]);
    expect(ivs[0]).toMatchObject({ consumption: null, perDay: null, days: 31 });
    expect(ivs[1]).toMatchObject({ consumption: 3_000 });
  });

  it("clamps a defensive negative to unknown", () => {
    const [iv] = buildIntervals([
      r("a", "2026-01-01", 500),
      r("b", "2026-02-01", 400),
    ]);
    expect(iv?.consumption).toBeNull();
  });
});

describe("validateReadingSequence", () => {
  it("accepts monotonic readings", () => {
    expect(
      validateReadingSequence([
        r("a", "2026-01-01", 1),
        r("b", "2026-02-01", 1),
        r("c", "2026-03-01", 2),
      ]),
    ).toBeNull();
  });

  it("returns the first decreasing non-reset reading", () => {
    expect(
      validateReadingSequence([
        r("a", "2026-01-01", 10),
        r("c", "2026-03-01", 5),
        r("b", "2026-02-01", 12),
      ]),
    ).toEqual({ readingId: "c", previousReadingId: "b" });
  });

  it("allows a decrease at a reset reading", () => {
    expect(
      validateReadingSequence([
        r("a", "2026-01-01", 10),
        r("b", "2026-02-01", 2, true),
      ]),
    ).toBeNull();
  });
});

describe("bucketByMonth", () => {
  it("attributes a 1st-to-1st interval to exactly one complete month", () => {
    const months = bucketByMonth(
      buildIntervals([r("a", "2026-01-01", 0), r("b", "2026-02-01", 3_100)]),
      2026,
      2026,
    );
    const jan = months[2026]![0]!;
    const feb = months[2026]![1]!;
    expect(jan).toMatchObject({
      coveredDays: 31,
      isComplete: true,
      consumption: 3_100,
    });
    expect(feb).toMatchObject({ coveredDays: 0, consumption: null });
  });

  it("pro-rates an interval inside one month as partial", () => {
    const months = bucketByMonth(
      buildIntervals([r("a", "2026-03-10", 0), r("b", "2026-03-20", 1_000)]),
      2026,
      2026,
    );
    const mar = months[2026]![2]!;
    expect(mar.coveredDays).toBe(10);
    expect(mar.isComplete).toBe(false);
    expect(mar.coverage).toBeCloseTo(10 / 31);
    expect(mar.consumption).toBe(1_000);
  });

  it("splits an interval spanning three months by days and sums to the total", () => {
    // 2026-01-15 → 2026-04-10 = 85 days; 8_500 milli → 100/day.
    const months = bucketByMonth(
      buildIntervals([r("a", "2026-01-15", 0), r("b", "2026-04-10", 8_500)]),
      2026,
      2026,
    );
    const [jan, feb, mar, apr] = months[2026]!;
    expect(jan!.coveredDays).toBe(17); // 15..31
    expect(feb!.coveredDays).toBe(28);
    expect(mar!.coveredDays).toBe(31);
    expect(apr!.coveredDays).toBe(9); // 1..9
    expect(feb!.isComplete).toBe(true);
    expect(mar!.isComplete).toBe(true);
    const sum = [jan, feb, mar, apr].reduce(
      (acc, b) => acc + (b!.consumption ?? 0),
      0,
    );
    expect(Math.abs(sum - 8_500)).toBeLessThanOrEqual(1);
  });

  it("requires 29 covered days for a leap-year February", () => {
    const months = bucketByMonth(
      buildIntervals([r("a", "2028-02-01", 0), r("b", "2028-03-01", 290)]),
      2028,
      2028,
    );
    expect(months[2028]![1]).toMatchObject({
      daysInMonth: 29,
      coveredDays: 29,
      isComplete: true,
      consumption: 290,
    });
  });

  it("sums weekly readings across a month boundary into complete months", () => {
    // Mondays 2026-06-01 .. 2026-08-03 (10 weeks), 70/week = 10/day.
    const readings: ReadingLike[] = [];
    for (let i = 0; i <= 9; i++) {
      const d = new Date(Date.UTC(2026, 5, 1 + 7 * i));
      readings.push(r(`w${i}`, d.toISOString().slice(0, 10), i * 70));
    }
    const months = bucketByMonth(buildIntervals(readings), 2026, 2026);
    const jun = months[2026]![5]!;
    const jul = months[2026]![6]!;
    expect(jun).toMatchObject({
      coveredDays: 30,
      isComplete: true,
      consumption: 300,
    });
    expect(jul).toMatchObject({
      coveredDays: 31,
      isComplete: true,
      consumption: 310,
    });
  });

  it("routes reset intervals into unknownDays and never completes the month", () => {
    const months = bucketByMonth(
      buildIntervals([
        r("a", "2026-05-01", 999),
        r("b", "2026-06-01", 10, true),
      ]),
      2026,
      2026,
    );
    expect(months[2026]![4]).toMatchObject({
      coveredDays: 0,
      unknownDays: 31,
      isComplete: false,
      consumption: null,
    });
  });

  it("ignores intervals outside the requested years", () => {
    const months = bucketByMonth(
      buildIntervals([r("a", "2024-01-01", 0), r("b", "2024-02-01", 100)]),
      2026,
      2026,
    );
    expect(months[2026]!.every((b) => b.consumption === null)).toBe(true);
    expect(months[2024]).toBeUndefined();
  });
});

describe("summarizeYears", () => {
  function yearBuckets(year: number, perMonth: Array<number | null>) {
    return perMonth.map((v, i) => {
      const dim = daysInMonth(year, i + 1);
      return {
        year,
        month: i + 1,
        daysInMonth: dim,
        coveredDays: v === null ? 0 : dim,
        unknownDays: 0,
        coverage: v === null ? 0 : 1,
        isComplete: v !== null,
        consumption: v,
      };
    });
  }

  it("totals complete months and compares like-for-like", () => {
    const months = {
      2025: yearBuckets(
        2025,
        [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
      ),
      2026: yearBuckets(2026, [
        90,
        90,
        90,
        90,
        90,
        90,
        90,
        90,
        null,
        null,
        null,
        null,
      ]),
    };
    const [y2025, y2026] = summarizeYears(months);
    expect(y2025).toMatchObject({
      completeMonths: 12,
      total: 1_200,
      averagePerMonth: 100,
      comparedMonths: 0,
      changeVsPreviousYearBps: null,
    });
    expect(y2026).toMatchObject({
      completeMonths: 8,
      total: 720,
      averagePerMonth: 90,
      comparedMonths: 8,
      changeVsPreviousYearBps: -1_000, // −10%
    });
  });

  it("returns null average and change when nothing is complete or prev sum is 0", () => {
    const months = {
      2025: yearBuckets(2025, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      2026: yearBuckets(2026, [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ]),
    };
    const [y2025, y2026] = summarizeYears(months);
    expect(y2025?.changeVsPreviousYearBps).toBeNull();
    expect(y2026).toMatchObject({
      completeMonths: 0,
      total: 0,
      averagePerMonth: null,
      changeVsPreviousYearBps: null,
    });
  });
});

describe("reminder schedule", () => {
  it("monthly: due on the configured day, clamped in short months", () => {
    const s: ReminderSettings = { ...monthly(), dayOfMonth: 31 };
    expect(isReminderDueToday(s, "2026-02-28")).toBe(true);
    expect(isReminderDueToday(s, "2026-02-27")).toBe(false);
    expect(isReminderDueToday(s, "2028-02-29")).toBe(true);
    expect(isReminderDueToday({ ...s, dayOfMonth: 30 }, "2026-04-30")).toBe(
      true,
    );
    expect(isReminderDueToday({ ...s, dayOfMonth: 1 }, "2026-09-01")).toBe(
      true,
    );
    expect(isReminderDueToday({ ...s, dayOfMonth: 1 }, "2026-09-02")).toBe(
      false,
    );
  });

  it("weekly: due on the configured ISO weekday", () => {
    const s: ReminderSettings = { ...monthly("weekly"), weekday: 1 };
    expect(isReminderDueToday(s, "2026-09-07")).toBe(true); // Monday
    expect(isReminderDueToday(s, "2026-09-08")).toBe(false);
    expect(isReminderDueToday({ ...s, weekday: 7 }, "2026-09-06")).toBe(true); // Sunday
  });

  it("never due when disabled", () => {
    expect(
      isReminderDueToday({ ...monthly(), enabled: false }, "2026-09-01"),
    ).toBe(false);
  });

  it("previousDueDate / nextDueDate for monthly", () => {
    const s = monthly();
    expect(previousDueDate(s, "2026-09-05")).toBe("2026-09-01");
    expect(previousDueDate(s, "2026-09-01")).toBe("2026-09-01");
    expect(previousDueDate({ ...s, dayOfMonth: 15 }, "2026-09-05")).toBe(
      "2026-08-15",
    );
    expect(previousDueDate({ ...s, dayOfMonth: 31 }, "2026-03-01")).toBe(
      "2026-02-28",
    );
    expect(previousDueDate({ ...s, dayOfMonth: 15 }, "2026-01-05")).toBe(
      "2025-12-15",
    );
    expect(nextDueDate(s, "2026-09-05")).toBe("2026-10-01");
    expect(nextDueDate(s, "2026-09-01")).toBe("2026-09-01");
    expect(nextDueDate({ ...s, dayOfMonth: 31 }, "2026-02-10")).toBe(
      "2026-02-28",
    );
    expect(nextDueDate({ ...s, dayOfMonth: 15 }, "2026-12-20")).toBe(
      "2027-01-15",
    );
  });

  it("previousDueDate / nextDueDate for weekly", () => {
    const s: ReminderSettings = { ...monthly("weekly"), weekday: 1 };
    expect(previousDueDate(s, "2026-09-10")).toBe("2026-09-07"); // Thu → Mon
    expect(previousDueDate(s, "2026-09-07")).toBe("2026-09-07");
    expect(nextDueDate(s, "2026-09-10")).toBe("2026-09-14");
    expect(nextDueDate({ ...s, weekday: 7 }, "2026-09-07")).toBe("2026-09-13");
  });

  it("isReadingOverdue with reminder enabled uses the last due date", () => {
    const s = monthly();
    expect(isReadingOverdue(s, null, "2026-09-05")).toBe(true);
    expect(isReadingOverdue(s, "2026-09-01", "2026-09-05")).toBe(false);
    expect(isReadingOverdue(s, "2026-08-31", "2026-09-05")).toBe(true);
    const weekly: ReminderSettings = { ...monthly("weekly"), weekday: 1 };
    expect(isReadingOverdue(weekly, "2026-09-07", "2026-09-10")).toBe(false);
    expect(isReadingOverdue(weekly, "2026-09-06", "2026-09-10")).toBe(true);
  });

  it("isReadingOverdue without a configured reminder is lenient", () => {
    const s: ReminderSettings = { ...monthly(), enabled: false };
    expect(isReadingOverdue(s, "2026-08-15", "2026-09-05")).toBe(false); // 21 days
    expect(isReadingOverdue(s, "2026-07-20", "2026-09-05")).toBe(true); // 47 days
    expect(
      isReadingOverdue({ ...s, cadence: "weekly" }, "2026-08-25", "2026-09-05"),
    ).toBe(true); // 11 days
  });
});

describe("findLastCompleteMonth", () => {
  it("walks back to the latest complete month and pairs it with last year", () => {
    const months = bucketByMonth(
      buildIntervals([
        r("a", "2025-07-01", 0),
        r("b", "2025-08-01", 100),
        r("c", "2025-09-01", 220),
        r("d", "2026-07-01", 1_000),
        r("e", "2026-08-01", 1_090),
        r("f", "2026-08-20", 1_150),
      ]),
      2025,
      2026,
    );
    expect(findLastCompleteMonth(months, "2026-09-05")).toEqual({
      year: 2026,
      month: 7,
      consumption: 90,
      previousYearConsumption: 100,
    });
  });

  it("returns null when nothing is complete", () => {
    const months = bucketByMonth(
      buildIntervals([r("a", "2026-09-01", 0), r("b", "2026-09-03", 5)]),
      2026,
      2026,
    );
    expect(findLastCompleteMonth(months, "2026-09-05")).toBeNull();
  });
});
