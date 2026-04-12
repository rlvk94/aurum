import { describe, it, expect } from "vitest";
import { getTableName, getTableColumns } from "drizzle-orm";
import { user, session, account, verification } from "./schema";

/**
 * Unit test — co-located with the schema it covers.
 *
 * Verifies that the Drizzle schema tables are defined correctly
 * and export the expected column structure.
 */

describe("database schema", () => {
  describe("user table", () => {
    it("is defined with the correct table name", () => {
      expect(getTableName(user)).toBe("user");
    });

    it("has required columns", () => {
      const columns = getTableColumns(user);
      const columnNames = Object.keys(columns);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("name");
      expect(columnNames).toContain("email");
      expect(columnNames).toContain("emailVerified");
      expect(columnNames).toContain("locale");
      expect(columnNames).toContain("createdAt");
      expect(columnNames).toContain("updatedAt");
    });
  });

  describe("session table", () => {
    it("is defined with the correct table name", () => {
      expect(getTableName(session)).toBe("session");
    });

    it("has required columns", () => {
      const columns = getTableColumns(session);
      const columnNames = Object.keys(columns);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("token");
      expect(columnNames).toContain("userId");
      expect(columnNames).toContain("expiresAt");
    });
  });

  describe("account table", () => {
    it("is defined with the correct table name", () => {
      expect(getTableName(account)).toBe("account");
    });
  });

  describe("verification table", () => {
    it("is defined with the correct table name", () => {
      expect(getTableName(verification)).toBe("verification");
    });
  });
});
