import { relations, sql } from "drizzle-orm";
import {
  date,
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
import { savings } from "./savings";
import { transaction } from "./transaction";

export const savingsTransactionSourceEnum = pgEnum(
  "savings_transaction_source",
  ["manual", "monthly_auto", "rounding_auto", "withdraw", "archive_return"],
);

// History of every move of money in or out of a savings goal. These rows
// never touch the underlying financial_account.balance — the parent
// account's real balance is unchanged. They drive the "visual balance"
// reduction (account.balance − sum(savings amounts on that account)).
export const savingsTransaction = pgTable(
  "savings_transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    savingsId: uuid("savings_id")
      .notNull()
      .references(() => savings.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => financialAccount.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    // Signed cents: positive = money moved into savings, negative = back to account.
    amount: integer("amount").notNull(),
    source: savingsTransactionSourceEnum("source").notNull(),
    // Set on rounding_auto rows so the UI can show "rounded from <expense>".
    triggeringTransactionId: uuid("triggering_transaction_id").references(
      () => transaction.id,
      { onDelete: "set null" },
    ),
    note: text("note"),
    date: date("date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("savings_transaction_savings_idx").on(
      table.savingsId,
      table.date.desc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("savings_transaction_account_idx").on(table.accountId),
    index("savings_transaction_triggering_idx")
      .on(table.triggeringTransactionId)
      .where(sql`${table.triggeringTransactionId} IS NOT NULL`),
  ],
);

export const savingsTransactionRelations = relations(
  savingsTransaction,
  ({ one }) => ({
    savings: one(savings, {
      fields: [savingsTransaction.savingsId],
      references: [savings.id],
    }),
    account: one(financialAccount, {
      fields: [savingsTransaction.accountId],
      references: [financialAccount.id],
    }),
    family: one(family, {
      fields: [savingsTransaction.familyId],
      references: [family.id],
    }),
    triggeringTransaction: one(transaction, {
      fields: [savingsTransaction.triggeringTransactionId],
      references: [transaction.id],
    }),
  }),
);
