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
    expect(result.mirroredSkipped).toBe(0);
  });

  it("classifies outgoing to an internal account as a transfer", () => {
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
      type: "transfer",
      transferAccountId: "acct-joint",
      amount: 58000,
    });
  });

  it("classifies outgoing to an external counter as an expense", () => {
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
    expect(result.matched[0]?.transferAccountId).toBeUndefined();
  });

  it("classifies incoming with empty counter as income when no matching transfer exists", () => {
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
    expect(result.mirroredSkipped).toBe(0);
  });

  it("drops the incoming mirror of an internal transfer in the same batch", () => {
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
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]?.type).toBe("transfer");
    expect(result.matched[0]?.transferAccountId).toBe("acct-salary");
    expect(result.mirroredSkipped).toBe(1);
  });

  it("handles mirror detection regardless of row order", () => {
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
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]?.type).toBe("transfer");
    expect(result.mirroredSkipped).toBe(1);
  });

  it("consumes each outgoing transfer at most once", () => {
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
    const transfers = result.matched.filter((r) => r.type === "transfer");
    const incomes = result.matched.filter((r) => r.type === "income");
    expect(transfers).toHaveLength(1);
    expect(incomes).toHaveLength(1);
    expect(result.mirroredSkipped).toBe(1);
  });

  it("does not treat an incoming row with a populated external counter as a mirror", () => {
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
    expect(result.mirroredSkipped).toBe(0);
  });

  it("does not mirror-match when date or amount differ", () => {
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
    expect(result.mirroredSkipped).toBe(0);
  });
});
