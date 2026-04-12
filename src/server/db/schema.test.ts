import { describe, it, expect } from "vitest";
import { getTableName, getTableColumns } from "drizzle-orm";
import { posts, user, session, account, verification } from "./schema";

/**
 * Example unit test — co-located with the schema it covers.
 *
 * These tests verify that the Drizzle schema tables are defined correctly
 * and export the expected column structure. They serve as a safety net
 * against accidental schema changes.
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

  describe("posts table", () => {
    it("is defined", () => {
      expect(posts).toBeDefined();
    });

    it("has required columns", () => {
      const columns = getTableColumns(posts);
      const columnNames = Object.keys(columns);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("name");
      expect(columnNames).toContain("createdById");
      expect(columnNames).toContain("createdAt");
    });
  });
});
