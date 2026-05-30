import { describe, expect, it } from "vitest";

import { deriveMerchantKey } from "./merchant-key";

describe("deriveMerchantKey", () => {
  it("reduces a noisy card line to the brand token", () => {
    expect(deriveMerchantKey("DK KORT NETTO HØRSHOLM 1234 28.05")).toBe("netto");
    // First token (>3 chars) is the stable brand key; the "1000" isn't appended.
    expect(deriveMerchantKey("Visa/Dankort REMA 1000 LYNGBY")).toBe("rema");
  });

  it("groups the same merchant across locations", () => {
    const a = deriveMerchantKey("NETTO HØRSHOLM 1234 28.05");
    const b = deriveMerchantKey("NETTO LYNGBY 5678 12.06");
    expect(a).toBe(b);
    expect(a).toBe("netto");
  });

  it("uses only the first token, so keys are stable across variants", () => {
    expect(deriveMerchantKey("Q8 ROSKILDE")).toBe("q8");
    expect(deriveMerchantKey("Q8")).toBe("q8");
    expect(deriveMerchantKey("H&M MAGASIN")).toBe("h&m");
    expect(deriveMerchantKey("H&M")).toBe("h&m");
  });

  it("returns null for transfers and bare reference rows", () => {
    expect(deriveMerchantKey("Overførsel")).toBeNull();
    expect(deriveMerchantKey("Straksoverførsel 0012345")).toBeNull();
    expect(deriveMerchantKey("")).toBeNull();
  });

  it("falls back to the payer metadata when the description has no merchant", () => {
    expect(
      deriveMerchantKey("Overførsel", { payer: "Udbetaling Danmark" }),
    ).toBe("udbetaling");
  });

  it("is deterministic and idempotent", () => {
    const once = deriveMerchantKey("DK KORT NETTO HØRSHOLM 1234 28.05");
    expect(deriveMerchantKey("DK KORT NETTO HØRSHOLM 1234 28.05")).toBe(once);
    expect(deriveMerchantKey("netto")).toBe("netto");
  });
});
