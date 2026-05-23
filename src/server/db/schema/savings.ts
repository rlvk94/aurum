import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { family } from "./family";
import { financialAccount } from "./financial-account";

export const savingsTransferModeEnum = pgEnum("savings_transfer_mode", [
  "manual",
  "monthly_fixed",
  "rounding",
]);

export const savings = pgTable(
  "savings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => financialAccount.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji").default("🎯").notNull(),
    // Palette key. Reuses the same set as projects (kept loose at the
    // schema layer; validated in the router).
    color: text("color").default("gold").notNull(),
    // Target amount in cents (positive).
    targetAmount: integer("target_amount").notNull(),
    // Running balance in cents, kept in sync with savings_transaction
    // amounts (same pattern as financial_account.balance).
    balance: integer("balance").default(0).notNull(),
    transferMode: savingsTransferModeEnum("transfer_mode")
      .default("manual")
      .notNull(),
    // Required when transfer_mode = monthly_fixed. Cents per month.
    monthlyAmount: integer("monthly_amount"),
    // Required when transfer_mode = rounding. Step in cents — 500, 1000,
    // 5000, 10000 map to 5/10/50/100 kr.
    roundingStep: integer("rounding_step"),
    // Non-null = auto-transfers paused (user paused or goal completed).
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    // First time balance >= target_amount. Drives celebration UI.
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archived: boolean("archived").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("savings_account_idx").on(table.accountId),
    index("savings_family_account_idx").on(table.familyId, table.accountId),
  ],
);

export const savingsRelations = relations(savings, ({ one }) => ({
  family: one(family, {
    fields: [savings.familyId],
    references: [family.id],
  }),
  account: one(financialAccount, {
    fields: [savings.accountId],
    references: [financialAccount.id],
  }),
}));
