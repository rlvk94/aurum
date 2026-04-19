import { relations, sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { category } from "./category";
import { family } from "./family";
import { financialAccount } from "./financial-account";

// ── Enums ───────────────────────────────────────────────────────────────────

export const transactionTypeEnum = pgEnum("transaction_type", [
  "expense",
  "income",
  "transfer",
]);

// ── Tables ──────────────────────────────────────────────────────────────────

export const transaction = pgTable(
  "transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => financialAccount.id, { onDelete: "cascade" }),
    transferAccountId: uuid("transfer_account_id").references(
      () => financialAccount.id,
      { onDelete: "set null" },
    ),
    categoryId: uuid("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    type: transactionTypeEnum("type").notNull(),
    amount: integer("amount").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    description: text("description").notNull(),
    note: text("note"),
    /**
     * Extra fields from source data (e.g. CSV payer, supplementary text).
     * Used for rule matching but not displayed in the UI.
     */
    metadata: jsonb("metadata").$type<Record<string, string>>(),
    externalId: text("external_id"),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("transaction_account_external_idx")
      .on(table.accountId, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    // Supports the transaction list query: family-scoped, ordered by
    // (date DESC, createdAt DESC, id DESC), with keyset pagination on
    // the same tuple.
    index("transaction_family_date_idx").on(
      table.familyId,
      table.date.desc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────

export const transactionRelations = relations(transaction, ({ one }) => ({
  family: one(family, {
    fields: [transaction.familyId],
    references: [family.id],
  }),
  account: one(financialAccount, {
    fields: [transaction.accountId],
    references: [financialAccount.id],
    relationName: "accountTransactions",
  }),
  transferAccount: one(financialAccount, {
    fields: [transaction.transferAccountId],
    references: [financialAccount.id],
    relationName: "transferTransactions",
  }),
  category: one(category, {
    fields: [transaction.categoryId],
    references: [category.id],
  }),
}));
