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

  it("sees through noisy statement prefixes to the merchant", () => {
    expect(deriveMerchantKey("Forretning: Proton")).toBe("proton");
    expect(deriveMerchantKey("Mobilepay: Nrgi Elhan")).toBe("nrgi");
    expect(deriveMerchantKey("Ydelse 0111261 Boliglån")).toBe("boliglån");
    expect(deriveMerchantKey("Kort Dk Mob.pay*rejsekort")).toBe("rejsekort");
    expect(deriveMerchantKey("Forretning: Thomann De Dk")).toBe("thomann");
    // "Sp" is a kept merchant abbreviation, so it is the stable key.
    expect(deriveMerchantKey("Forretning: Sp Juleeventyr")).toBe("sp");
  });

  it("reduces real-world Danske Bank card/online lines to the brand", () => {
    expect(deriveMerchantKey("Køb kort DK NETTO HASLEV")).toBe("netto");
    expect(deriveMerchantKey("KØB KORT DK AURUM")).toBe("aurum");
    expect(deriveMerchantKey("Køb kort DK LIDL225HASLEV")).toBe("lidl");
    expect(deriveMerchantKey("Køb kort DK MENY R@NNEDE")).toBe("meny");
    expect(deriveMerchantKey("DK-NOTA52017 ZINKBAKKEN.DK/")).toBe("zinkbakken");
    expect(deriveMerchantKey("DK-NOTAf145d SAXO.COM")).toBe("saxo");
    expect(deriveMerchantKey("DK-NOTAC3414 GRUSDIREKTE APS")).toBe(
      "grusdirekte",
    );
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
