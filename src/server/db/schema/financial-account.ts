import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { family } from "./family";

// ── Enums ───────────────────────────────────────────────────────────────────

export const accountTypeEnum = pgEnum("account_type", [
  "checking",
  "savings",
  "gift",
  "financial_freedom",
  "fixed_costs",
  "investment",
  "other",
]);

export const accountVisibilityEnum = pgEnum("account_visibility", [
  "shared",
  "private",
]);

// ── Tables ──────────────────────────────────────────────────────────────────

export const financialAccount = pgTable("financial_account", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => family.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  identifier: text("identifier").notNull().unique(),
  type: accountTypeEnum("type").notNull(),
  visibility: accountVisibilityEnum("visibility").default("shared").notNull(),
  balance: integer("balance").default(0).notNull(),
  includeInNetWorth: boolean("include_in_net_worth").default(true).notNull(),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const financialAccountAccess = pgTable(
  "financial_account_access",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => financialAccount.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.userId] })],
);

// ── Relations ───────────────────────────────────────────────────────────────

export const financialAccountRelations = relations(
  financialAccount,
  ({ one, many }) => ({
    family: one(family, {
      fields: [financialAccount.familyId],
      references: [family.id],
    }),
    accessList: many(financialAccountAccess),
  }),
);

export const financialAccountAccessRelations = relations(
  financialAccountAccess,
  ({ one }) => ({
    account: one(financialAccount, {
      fields: [financialAccountAccess.accountId],
      references: [financialAccount.id],
    }),
    user: one(user, {
      fields: [financialAccountAccess.userId],
      references: [user.id],
    }),
  }),
);
