import { describe, expect, it } from "vitest";

import { buildBreadcrumb, findRoute, getPaletteRoutes } from "./navigation";

describe("findRoute", () => {
  it("returns exact match", () => {
    expect(findRoute("/dashboard")?.path).toBe("/dashboard");
    expect(findRoute("/budgets/annual")?.path).toBe("/budgets/annual");
  });

  it("returns longest-prefix match for dynamic segments", () => {
    expect(findRoute("/debts/abc-123")?.path).toBe("/debts");
    expect(findRoute("/settings/profile/edit")?.path).toBe("/settings/profile");
  });

  it("returns undefined for unknown pathname", () => {
    expect(findRoute("/totally-unknown")).toBeUndefined();
  });
});

describe("buildBreadcrumb", () => {
  it("returns a single entry for the dashboard root", () => {
    expect(buildBreadcrumb("/dashboard").map((r) => r.path)).toEqual([
      "/dashboard",
    ]);
  });

  it("roots top-level pages at /dashboard", () => {
    expect(buildBreadcrumb("/accounts").map((r) => r.path)).toEqual([
      "/dashboard",
      "/accounts",
    ]);
  });

  it("chains dashboard → parent → child for nested pages", () => {
    expect(buildBreadcrumb("/budgets/annual").map((r) => r.path)).toEqual([
      "/dashboard",
      "/budgets",
      "/budgets/annual",
    ]);
  });

  it("chains dashboard → settings → subpage", () => {
    expect(buildBreadcrumb("/settings/appearance").map((r) => r.path)).toEqual([
      "/dashboard",
      "/settings",
      "/settings/appearance",
    ]);
  });

  it("returns empty array for unknown pathname", () => {
    expect(buildBreadcrumb("/nope")).toEqual([]);
  });
});

describe("getPaletteRoutes", () => {
  it("excludes routes flagged as hideFromPalette", () => {
    const paths = getPaletteRoutes().map((r) => r.path);
    expect(paths).not.toContain("/budgets");
    expect(paths).toContain("/budgets/annual");
    expect(paths).toContain("/settings");
  });
});
