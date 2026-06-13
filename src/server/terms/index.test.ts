import { describe, expect, it } from "vitest";

import { TERMS_VERSIONS, getCurrentTerms, getTermsByVersion } from "./index";

describe("terms bundle", () => {
  it("ships at least one version with da + en content", () => {
    expect(TERMS_VERSIONS.length).toBeGreaterThan(0);
    for (const t of TERMS_VERSIONS) {
      expect(t.content.da.trim().length).toBeGreaterThan(0);
      expect(t.content.en.trim().length).toBeGreaterThan(0);
    }
  });

  it("includes the 'we may change these terms' clause in both locales", () => {
    const current = getCurrentTerms();
    expect(current.content.da.toLowerCase()).toContain(
      "kan til enhver tid ændre disse vilkår",
    );
    expect(current.content.en.toLowerCase()).toContain(
      "may change these terms at any time",
    );
  });

  it("getCurrentTerms returns the newest effective version", () => {
    // 2026-05-30 is effective by this date.
    const current = getCurrentTerms(new Date("2026-06-01T00:00:00Z"));
    expect(current.version).toBe("2026-05-30");
  });

  it("getCurrentTerms never returns undefined even before any effectiveDate", () => {
    const current = getCurrentTerms(new Date("2000-01-01T00:00:00Z"));
    expect(current).toBeDefined();
    expect(current.version).toBeTruthy();
  });

  it("getTermsByVersion resolves a known version and rejects unknown", () => {
    expect(getTermsByVersion("2026-05-30")?.version).toBe("2026-05-30");
    expect(getTermsByVersion("nope")).toBeUndefined();
  });

  it("2026-06-13 covers push notifications in both locales", () => {
    const v = getTermsByVersion("2026-06-13");
    expect(v).toBeDefined();
    expect(v!.content.da.toLowerCase()).toContain("push-beskeder");
    expect(v!.content.en.toLowerCase()).toContain("push notifications");
    // Derived from the prior version → must still carry the change clause.
    expect(v!.content.en.toLowerCase()).toContain(
      "may change these terms at any time",
    );
  });
});
