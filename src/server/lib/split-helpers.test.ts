import { describe, expect, it } from "vitest";

import { checkSplittableOriginal, validateSplitParts } from "./split-helpers";

describe("validateSplitParts", () => {
  it("accepts parts that sum exactly to the original", () => {
    expect(
      validateSplitParts(1000, [{ amount: 600 }, { amount: 400 }]),
    ).toEqual({ ok: true });
  });

  it("accepts more than two parts when they sum exactly", () => {
    expect(
      validateSplitParts(1000, [
        { amount: 500 },
        { amount: 300 },
        { amount: 200 },
      ]),
    ).toEqual({ ok: true });
  });

  it("rejects fewer than two parts", () => {
    expect(validateSplitParts(1000, [{ amount: 1000 }])).toEqual({
      ok: false,
      reason: "too_few_parts",
    });
    expect(validateSplitParts(1000, [])).toEqual({
      ok: false,
      reason: "too_few_parts",
    });
  });

  it("rejects when parts do not sum to the original (over and under)", () => {
    expect(
      validateSplitParts(1000, [{ amount: 600 }, { amount: 300 }]),
    ).toEqual({ ok: false, reason: "sum_mismatch" });
    expect(
      validateSplitParts(1000, [{ amount: 600 }, { amount: 500 }]),
    ).toEqual({ ok: false, reason: "sum_mismatch" });
  });

  it("rejects non-positive part amounts", () => {
    expect(validateSplitParts(1000, [{ amount: 1000 }, { amount: 0 }])).toEqual(
      { ok: false, reason: "non_positive_amount" },
    );
    expect(
      validateSplitParts(1000, [{ amount: 1100 }, { amount: -100 }]),
    ).toEqual({ ok: false, reason: "non_positive_amount" });
  });

  it("rejects non-integer (fractional-cent) amounts", () => {
    expect(
      validateSplitParts(1000, [{ amount: 999.5 }, { amount: 0.5 }]),
    ).toEqual({ ok: false, reason: "non_integer_amount" });
  });
});

describe("checkSplittableOriginal", () => {
  it("allows a plain expense/income original", () => {
    expect(
      checkSplittableOriginal({ transferGroupId: null, splitParentId: null }),
    ).toEqual({ ok: true });
  });

  it("rejects a transfer leg", () => {
    expect(
      checkSplittableOriginal({
        transferGroupId: "grp-1",
        splitParentId: null,
      }),
    ).toEqual({ ok: false, reason: "is_transfer" });
  });

  it("rejects a part of an existing split (no nested splits)", () => {
    expect(
      checkSplittableOriginal({
        transferGroupId: null,
        splitParentId: "orig-1",
      }),
    ).toEqual({ ok: false, reason: "is_part" });
  });
});
