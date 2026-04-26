import { describe, expect, it } from "vitest";
import {
  buildDefaultMapping,
  parseWithMapping,
  validateMapping,
} from "./generic";
import type { ColumnMapping } from "./types";

const baseSigned: ColumnMapping = {
  encoding: "utf-8",
  delimiter: ",",
  hasHeader: true,
  dateColumn: 0,
  dateFormat: "yyyy-MM-dd",
  descriptionColumn: 1,
  amountMode: "signed",
  amountColumn: 2,
  numberFormat: "dot-decimal",
  exportAccountColumn: 3,
};

describe("parseWithMapping (signed)", () => {
  it("maps signed amount to outgoing/incoming", () => {
    const table = [
      ["Date", "Description", "Amount", "Account"],
      ["2024-01-15", "Coffee", "-50.00", "1234567890"],
      ["2024-01-16", "Salary", "12500.00", "1234567890"],
    ];
    const { rows } = parseWithMapping(table, baseSigned);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "2024-01-15",
      description: "Coffee",
      amount: -5000,
      direction: "outgoing",
      exportAccount: "1234567890",
    });
    expect(rows[1]).toMatchObject({
      date: "2024-01-16",
      description: "Salary",
      amount: 1250000,
      direction: "incoming",
    });
  });

  it("drops rows with unparseable date or amount", () => {
    const table = [
      ["Date", "Description", "Amount", "Account"],
      ["bad", "Coffee", "-50.00", "1"],
      ["2024-01-15", "X", "junk", "1"],
      ["2024-01-15", "Y", "-1.00", "1"],
    ];
    const { rows } = parseWithMapping(table, baseSigned);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.description).toBe("Y");
  });

  it("captures unmapped headered columns into metadata", () => {
    const table = [
      ["Date", "Description", "Amount", "Account", "Reference", "Category"],
      ["2024-01-15", "Coffee", "-50.00", "1", "REF123", "Food"],
    ];
    const { rows } = parseWithMapping(table, baseSigned);
    expect(rows[0]?.metadata).toEqual({ Reference: "REF123", Category: "Food" });
  });

  it("uses balance in externalId when mapped", () => {
    const table = [
      ["Date", "Desc", "Amount", "Account", "Balance"],
      ["2024-01-15", "X", "-50.00", "1", "100.00"],
    ];
    const { rows } = parseWithMapping(table, {
      ...baseSigned,
      balanceColumn: 4,
    });
    expect(rows[0]?.externalId).toBe("2024-01-15:-5000:10000");
  });

  it("falls back to row index in externalId when no balance column", () => {
    const table = [
      ["Date", "Desc", "Amount", "Account"],
      ["2024-01-15", "X", "-50.00", "1"],
    ];
    const { rows } = parseWithMapping(table, baseSigned);
    expect(rows[0]?.externalId).toBe("2024-01-15:-5000:row1");
  });

  it("does not skip the first row when hasHeader is false", () => {
    const table = [["2024-01-15", "X", "-50.00", "1"]];
    const { rows } = parseWithMapping(table, {
      ...baseSigned,
      hasHeader: false,
    });
    expect(rows).toHaveLength(1);
  });

  it("returns diagnostics describing why rows were dropped", () => {
    const table = [
      ["Date", "Description", "Amount", "Account"],
      ["bad-date", "Coffee", "-50.00", "1"],
      ["2024-01-15", "X", "junk", "1"],
      ["2024-01-15", "Zero", "0.00", "1"],
      ["2024-01-15", "Y", "-1.00", "1"],
    ];
    const { rows, diagnostics } = parseWithMapping(table, baseSigned);
    expect(rows).toHaveLength(1);
    expect(diagnostics).toMatchObject({
      totalRows: 4,
      produced: 1,
      droppedInvalidDate: 1,
      droppedInvalidAmount: 1,
      droppedZeroAmount: 1,
      sampleInvalidDate: "bad-date",
      sampleInvalidAmount: "junk",
    });
  });
});

describe("parseWithMapping (split debit/credit)", () => {
  const split: ColumnMapping = {
    ...baseSigned,
    amountMode: "split",
    amountColumn: undefined,
    debitColumn: 2,
    creditColumn: 3,
    exportAccountColumn: 4,
  };

  it("treats debit as outgoing and credit as incoming", () => {
    const table = [
      ["Date", "Description", "Debit", "Credit", "Account"],
      ["2024-01-15", "Coffee", "50.00", "", "1"],
      ["2024-01-16", "Salary", "", "12500.00", "1"],
    ];
    const { rows } = parseWithMapping(table, split);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ amount: -5000, direction: "outgoing" });
    expect(rows[1]).toMatchObject({ amount: 1250000, direction: "incoming" });
  });

  it("drops rows where both debit and credit are zero", () => {
    const table = [
      ["Date", "Description", "Debit", "Credit", "Account"],
      ["2024-01-15", "Pending", "", "", "1"],
      ["2024-01-15", "Real", "10.00", "", "1"],
    ];
    const { rows } = parseWithMapping(table, split);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.description).toBe("Real");
  });
});

describe("buildDefaultMapping", () => {
  it("matches Danish-style headers", () => {
    const table = [
      ["Dato", "Tekst", "Beløb", "Saldo", "Kontonr"],
      ["2024-01-15", "X", "-50,00", "100,00", "1234567890"],
    ];
    const mapping = buildDefaultMapping(table, {
      encoding: "utf-8",
      delimiter: ";",
    });
    expect(mapping).toMatchObject({
      hasHeader: true,
      dateColumn: 0,
      descriptionColumn: 1,
      amountColumn: 2,
      balanceColumn: 3,
      exportAccountColumn: 4,
      amountMode: "signed",
    });
  });

  it("picks split mode when only debit/credit headers exist", () => {
    const table = [
      ["Date", "Description", "Debit", "Credit", "Account"],
      ["2024-01-15", "X", "10.00", "", "1"],
    ];
    const mapping = buildDefaultMapping(table, {
      encoding: "utf-8",
      delimiter: ",",
    });
    expect(mapping.amountMode).toBe("split");
    expect(mapping.debitColumn).toBe(2);
    expect(mapping.creditColumn).toBe(3);
    expect(mapping.amountColumn).toBeUndefined();
  });
});

describe("validateMapping", () => {
  it("flags missing amount column in signed mode", () => {
    const errors = validateMapping({ ...baseSigned, amountColumn: undefined });
    expect(errors).toContain("amountColumnRequired");
  });

  it("flags missing or duplicate debit/credit in split mode", () => {
    const errors = validateMapping({
      ...baseSigned,
      amountMode: "split",
      amountColumn: undefined,
      debitColumn: 2,
      creditColumn: 2,
    });
    expect(errors).toContain("debitCreditRequired");
  });

  it("flags duplicate hard-mapped columns", () => {
    const errors = validateMapping({ ...baseSigned, descriptionColumn: 0 });
    expect(errors).toContain("duplicateColumns");
  });

  it("returns no errors for a valid mapping", () => {
    expect(validateMapping(baseSigned)).toEqual([]);
  });
});
