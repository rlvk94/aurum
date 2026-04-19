import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { category } from "./category";
import { family } from "./family";
import { financialAccount } from "./financial-account";

// ── Enums ───────────────────────────────────────────────────────────────────

export const budgetRecurrenceEnum = pgEnum("budget_recurrence", [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "custom",
]);

// ── Tables ──────────────────────────────────────────────────────────────────

// A budget is a family-scoped plan for a single calendar year. A family can
// have multiple named budgets per year (e.g. "Household 2026", "Vacation 2026").
export const budget = pgTable(
  "budget",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("budget_family_year_idx").on(table.familyId, table.year)],
);

// A line on a budget, tied to an expense category and holding 12 per-month
// planned amounts (cents/øre). Recurrence is stored as the user's declared
// intent and used as a helper when generating or redistributing amounts;
// cell edits do NOT mutate it.
export const budgetLine = pgTable(
  "budget_line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => budget.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    // Human-readable label. Required so a family can reliably distinguish
    // multiple lines against the same category (e.g. "Weekly shop" vs "Pantry
    // stock" under Groceries).
    name: text("name").notNull(),
    recurrence: budgetRecurrenceEnum("recurrence").notNull(),
    // The first month (0..11) in which a recurring charge lands. Only
    // meaningful for non-monthly, non-custom recurrences. Null means "use the
    // default anchor" (Dec for annual, Jun+Dec for semi-annual, Mar/Jun/Sep/Dec
    // for quarterly).
    startMonth: integer("start_month"),
    amounts: jsonb("amounts")
      .$type<number[]>()
      .notNull()
      .default([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("budget_line_budget_idx").on(table.budgetId)],
);

// Join table scoping a budget to specific financial accounts. Empty set (no
// rows) means "all family accounts" — actuals will include every family
// expense in the budget's year regardless of which account it hit.
export const budgetAccount = pgTable(
  "budget_account",
  {
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => budget.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => financialAccount.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.budgetId, table.accountId] })],
);

// ── Relations ───────────────────────────────────────────────────────────────

export const budgetRelations = relations(budget, ({ one, many }) => ({
  family: one(family, {
    fields: [budget.familyId],
    references: [family.id],
  }),
  lines: many(budgetLine),
  accounts: many(budgetAccount),
}));

export const budgetLineRelations = relations(budgetLine, ({ one }) => ({
  budget: one(budget, {
    fields: [budgetLine.budgetId],
    references: [budget.id],
  }),
  category: one(category, {
    fields: [budgetLine.categoryId],
    references: [category.id],
  }),
}));

export const budgetAccountRelations = relations(budgetAccount, ({ one }) => ({
  budget: one(budget, {
    fields: [budgetAccount.budgetId],
    references: [budget.id],
  }),
  account: one(financialAccount, {
    fields: [budgetAccount.accountId],
    references: [financialAccount.id],
  }),
}));
