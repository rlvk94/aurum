import { relations } from "drizzle-orm";
import {
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { asset } from "./asset";
import { family } from "./family";

export const paymentFrequencyEnum = pgEnum("payment_frequency", [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "bi_monthly",
]);

// Loan-style debt: principal, interest rate, term, start date.
// Outstanding balance is computed from these fields using the amortization
// formula — not stored. Currency amounts in cents, interest rate in basis
// points (e.g. 350 = 3.50% APR).
export const debt = pgTable("debt", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => family.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  lender: text("lender").notNull(),
  principal: integer("principal").notNull(),
  interestRateBps: integer("interest_rate_bps").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  termMonths: integer("term_months").notNull(),
  paymentFrequency: paymentFrequencyEnum("payment_frequency")
    .default("monthly")
    .notNull(),
  assetId: uuid("asset_id").references(() => asset.id, {
    onDelete: "set null",
  }),
  note: text("note"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const debtRelations = relations(debt, ({ one }) => ({
  family: one(family, {
    fields: [debt.familyId],
    references: [family.id],
  }),
  asset: one(asset, {
    fields: [debt.assetId],
    references: [asset.id],
  }),
}));
