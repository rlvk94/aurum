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

// ── Enums ───────────────────────────────────────────────────────────────────

export const incomePlanAllocationTypeEnum = pgEnum(
  "income_plan_allocation_type",
  ["percentage", "fixed"],
);

// ── Tables ──────────────────────────────────────────────────────────────────

// An income plan is a template describing monthly income sources and how they
// are split across the family's accounts. Only one plan per family may be
// active at a time; the active plan is the one surfaced on the dashboard.
export const incomePlan = pgTable(
  "income_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(false).notNull(),
    archived: boolean("archived").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("income_plan_family_idx").on(table.familyId)],
);

// A named monthly income source on a plan (e.g. "Salary", "Freelance").
// Amount is stored in cents / øre — matches financial_account.balance.
export const incomePlanIncome = pgTable(
  "income_plan_income",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => incomePlan.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount: integer("amount").default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("income_plan_income_plan_idx").on(table.planId)],
);

// An allocation line on a plan, mapping a slice of total income to a specific
// account. `value` is interpreted per `allocationType`:
//   - percentage → basis points (2500 = 25.00%). Range 0–10000.
//   - fixed      → cents / øre.
// accountId is set-null on account delete so the line surfaces a "deleted
// account" state instead of silently disappearing.
export const incomePlanLine = pgTable(
  "income_plan_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => incomePlan.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => financialAccount.id, {
      onDelete: "set null",
    }),
    allocationType: incomePlanAllocationTypeEnum("allocation_type").notNull(),
    value: integer("value").default(0).notNull(),
    note: text("note"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("income_plan_line_plan_idx").on(table.planId)],
);

// ── Relations ───────────────────────────────────────────────────────────────

export const incomePlanRelations = relations(incomePlan, ({ one, many }) => ({
  family: one(family, {
    fields: [incomePlan.familyId],
    references: [family.id],
  }),
  incomes: many(incomePlanIncome),
  lines: many(incomePlanLine),
}));

export const incomePlanIncomeRelations = relations(
  incomePlanIncome,
  ({ one }) => ({
    plan: one(incomePlan, {
      fields: [incomePlanIncome.planId],
      references: [incomePlan.id],
    }),
  }),
);

export const incomePlanLineRelations = relations(incomePlanLine, ({ one }) => ({
  plan: one(incomePlan, {
    fields: [incomePlanLine.planId],
    references: [incomePlan.id],
  }),
  account: one(financialAccount, {
    fields: [incomePlanLine.accountId],
    references: [financialAccount.id],
  }),
}));
