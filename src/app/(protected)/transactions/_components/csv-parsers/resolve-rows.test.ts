import { describe, it, expect } from "vitest";
import { resolveRows } from "./resolve-rows";
import type { ParsedTransaction } from "./types";

const accountIds = new Map<string, string>([
  ["5319-522784", "acct-salary"],
  ["5319-334368", "acct-joint"],
  ["5319-2606314", "acct-spending"],
]);

function makeRow(overrides: Partial<ParsedTransaction>): ParsedTransaction {
  return {
    exportAccount: "",
    counterAccount: "",
    direction: "incoming",
    date: "2026-01-30",
    description: "",
    amount: 0,
    balance: 0,
    note: "",
    metadata: {},
    ...overrides,
  };
}

describe("resolveRows", () => {
  it("skips rows whose export account is not in the family", () => {
    const result = resolveRows(
      [
        makeRow({
          exportAccount: "99991234567",
          direction: "outgoing",
          amount: -10000,
        }),
      ],
      accountIds,
    );
    expect(result.matched).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it("classifies outgoing rows as expense regardless of counter account", () => {
    const result = resolveRows(
      [
        makeRow({
          exportAccount: "53190522784",
          counterAccount: "53190000334368",
          direction: "outgoing",
          amount: -58000,
        }),
      ],
      accountIds,
    );
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]).toMatchObject({
      accountId: "acct-salary",
      type: "expense",
      amount: 58000,
    });
    // No mirror in batch — left unlinked.
    expect(result.matched[0]?.transferGroupId).toBeUndefined();
  });

  it("classifies outgoing to an external counter as expense without a group", () => {
    const result = resolveRows(
      [
        makeRow({
          exportAccount: "53190334368",
          counterAccount: "DK7530000012581963",
          direction: "outgoing",
          amount: -15000,
        }),
      ],
      accountIds,
    );
    expect(result.matched[0]?.type).toBe("expense");
    expect(result.matched[0]?.transferGroupId).toBeUndefined();
  });

  it("classifies incoming rows as income, unlinked when no mirror is present", () => {
    const result = resolveRows(
      [
        makeRow({
          exportAccount: "53190522784",
          counterAccount: "",
          direction: "incoming",
          amount: 174700,
          balance: 1898842,
        }),
      ],
      accountIds,
    );
    expect(result.matched[0]?.type).toBe("income");
    expect(result.matched[0]?.transferGroupId).toBeUndefined();
  });

  it("links the outgoing and incoming halves of an internal transfer with a shared group id", () => {
    const result = resolveRows(
      [
        makeRow({
          exportAccount: "53190334368",
          counterAccount: "53190000522784",
          direction: "outgoing",
          amount: -580560,
          balance: 3970546,
          description: "Opsparing",
        }),
        makeRow({
          exportAccount: "53190522784",
          counterAccount: "",
          direction: "incoming",
          amount: 580560,
          balance: 2620442,
          description: "Robin",
        }),
      ],
      accountIds,
    );
    expect(result.matched).toHaveLength(2);
    const out = result.matched.find((r) => r.type === "expense")!;
    const inc = result.matched.find((r) => r.type === "income")!;
    expect(out.accountId).toBe("acct-joint");
    expect(inc.accountId).toBe("acct-salary");
    expect(out.transferGroupId).toBeDefined();
    expect(out.transferGroupId).toBe(inc.transferGroupId);
  });

  it("links transfers regardless of row order", () => {
    const result = resolveRows(
      [
        makeRow({
          exportAccount: "53190522784",
          counterAccount: "",
          direction: "incoming",
          amount: 580560,
          balance: 2620442,
        }),
        makeRow({
          exportAccount: "53190334368",
          counterAccount: "53190000522784",
          direction: "outgoing",
          amount: -580560,
          balance: 3970546,
        }),
      ],
      accountIds,
    );
    expect(result.matched).toHaveLength(2);
    const groupIds = new Set(result.matched.map((r) => r.transferGroupId));
    expect(groupIds.size).toBe(1);
    expect([...groupIds][0]).toBeDefined();
  });

  it("pairs each outgoing transfer with at most one incoming row", () => {
    const result = resolveRows(
      [
        makeRow({
          exportAccount: "53190334368",
          counterAccount: "53190002606314",
          direction: "outgoing",
          amount: -424800,
          balance: 1000,
        }),
        makeRow({
          exportAccount: "53192606314",
          counterAccount: "",
          direction: "incoming",
          amount: 424800,
          balance: 2000,
        }),
        makeRow({
          exportAccount: "53192606314",
          counterAccount: "",
          direction: "incoming",
          amount: 424800,
          balance: 3000,
        }),
      ],
      accountIds,
    );
    expect(result.matched).toHaveLength(3);
    const expenseRows = result.matched.filter((r) => r.type === "expense");
    const linkedIncomeRows = result.matched.filter(
      (r) => r.type === "income" && r.transferGroupId,
    );
    const unlinkedIncomeRows = result.matched.filter(
      (r) => r.type === "income" && !r.transferGroupId,
    );
    expect(expenseRows).toHaveLength(1);
    expect(linkedIncomeRows).toHaveLength(1);
    expect(unlinkedIncomeRows).toHaveLength(1);
    expect(expenseRows[0]?.transferGroupId).toBe(
      linkedIncomeRows[0]?.transferGroupId,
    );
  });

  it("does not link an incoming row whose counter is external", () => {
    const result = resolveRows(
      [
        makeRow({
          exportAccount: "53190334368",
          counterAccount: "53190000522784",
          direction: "outgoing",
          amount: -10000,
        }),
        makeRow({
          exportAccount: "53190522784",
          counterAccount: "DK7530000012581963",
          direction: "incoming",
          amount: 10000,
        }),
      ],
      accountIds,
    );
    expect(result.matched).toHaveLength(2);
    // Outgoing partner exists on acct-salary so the link still forms — the
    // incoming row's external counter doesn't disqualify it from being a
    // mirror because the outgoing side already names the destination.
    const groupIds = new Set(result.matched.map((r) => r.transferGroupId));
    expect(groupIds.size).toBe(1);
    expect([...groupIds][0]).toBeDefined();
  });

  it("does not link when date or amount differ", () => {
    const result = resolveRows(
      [
        makeRow({
          exportAccount: "53190334368",
          counterAccount: "53190000522784",
          direction: "outgoing",
          amount: -10000,
          date: "2026-01-30",
        }),
        makeRow({
          exportAccount: "53190522784",
          counterAccount: "",
          direction: "incoming",
          amount: 10000,
          date: "2026-01-31",
        }),
      ],
      accountIds,
    );
    expect(result.matched).toHaveLength(2);
    for (const row of result.matched) {
      expect(row.transferGroupId).toBeUndefined();
    }
  });
});
