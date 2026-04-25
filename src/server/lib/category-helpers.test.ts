import { describe, expect, it } from "vitest";

import { buildExpansionMap, rollupActuals } from "./category-helpers";

describe("buildExpansionMap", () => {
  it("expands a top-level id to itself + all its children", () => {
    const rows = [
      { id: "p1", parentId: null },
      { id: "c1", parentId: "p1" },
      { id: "c2", parentId: "p1" },
      { id: "p2", parentId: null },
    ];
    const map = buildExpansionMap(rows, ["p1"]);
    expect(map.size).toBe(1);
    expect(map.get("p1")?.sort()).toEqual(["c1", "c2", "p1"].sort());
  });

  it("expands a leaf to itself only", () => {
    const rows = [
      { id: "p1", parentId: null },
      { id: "c1", parentId: "p1" },
    ];
    const map = buildExpansionMap(rows, ["c1"]);
    expect(map.get("c1")).toEqual(["c1"]);
  });

  it("handles mixed parent + leaf input without double-listing", () => {
    const rows = [
      { id: "p1", parentId: null },
      { id: "c1", parentId: "p1" },
      { id: "c2", parentId: "p1" },
    ];
    const map = buildExpansionMap(rows, ["p1", "c2"]);
    expect(map.get("p1")?.sort()).toEqual(["c1", "c2", "p1"].sort());
    expect(map.get("c2")).toEqual(["c2"]);
  });

  it("drops unknown ids from the map", () => {
    const rows = [{ id: "p1", parentId: null }];
    const map = buildExpansionMap(rows, ["p1", "ghost"]);
    expect(map.has("ghost")).toBe(false);
    expect(map.has("p1")).toBe(true);
  });

  it("returns an empty map for empty input", () => {
    expect(buildExpansionMap([], []).size).toBe(0);
  });

  it("expands a parent with no children to itself only", () => {
    const rows = [{ id: "p1", parentId: null }];
    const map = buildExpansionMap(rows, ["p1"]);
    expect(map.get("p1")).toEqual(["p1"]);
  });
});

describe("rollupActuals", () => {
  function months(...vals: number[]): number[] {
    const arr: number[] = new Array<number>(12).fill(0);
    for (let i = 0; i < vals.length && i < 12; i++) arr[i] = vals[i] ?? 0;
    return arr;
  }

  it("rolls up children's monthly totals under the parent line", () => {
    const expansion = new Map([["p1", ["p1", "c1", "c2"]]]);
    const txTotals = new Map([
      ["c1", months(100, 0, 50)],
      ["c2", months(0, 200, 50)],
    ]);
    const result = rollupActuals(expansion, txTotals);
    expect(result.get("p1")).toEqual(months(100, 200, 100));
  });

  it("passes through a leaf line", () => {
    const expansion = new Map([["c1", ["c1"]]]);
    const txTotals = new Map([["c1", months(42)]]);
    const result = rollupActuals(expansion, txTotals);
    expect(result.get("c1")).toEqual(months(42));
  });

  it("returns 12 zeros for a parent with no spend on any child", () => {
    const expansion = new Map([["p1", ["p1", "c1"]]]);
    const result = rollupActuals(expansion, new Map());
    expect(result.get("p1")).toEqual(new Array(12).fill(0));
  });

  it("handles partial children with spend", () => {
    const expansion = new Map([["p1", ["p1", "c1", "c2", "c3"]]]);
    const txTotals = new Map([["c2", months(0, 0, 0, 999)]]);
    const result = rollupActuals(expansion, txTotals);
    expect(result.get("p1")).toEqual(months(0, 0, 0, 999));
  });

  it("supports negative net amounts (income exceeds expense)", () => {
    const expansion = new Map([["p1", ["p1", "c1"]]]);
    const txTotals = new Map([["c1", months(-50, 100)]]);
    const result = rollupActuals(expansion, txTotals);
    expect(result.get("p1")).toEqual(months(-50, 100));
  });
});
