import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { category } from "./category";
import { debt } from "./debt";
import { family } from "./family";
import { financialAccount } from "./financial-account";

// ── Enums ───────────────────────────────────────────────────────────────────

export const challengeTypeEnum = pgEnum("challenge_type", [
  "spend_less",
  "savings",
  "pay_off_loan",
  "net_worth_goal",
]);

export const challengeRepetitionEnum = pgEnum("challenge_repetition", [
  "one_off",
  "weekly",
  "monthly",
  "yearly",
  "custom",
]);

export const challengeInstanceStatusEnum = pgEnum("challenge_instance_status", [
  "active",
  "completed",
  "failed",
  "archived",
]);

// ── Tables ──────────────────────────────────────────────────────────────────

// Gamified, time-boxed goal. Four types:
//   - spend_less     → sum of expense transactions in a category ≤ target
//   - savings        → increase of an account balance ≥ target
//   - pay_off_loan   → sum of expense transactions in a category ≥ target (optional debt link)
//   - net_worth_goal → family net worth (accounts + assets − debt) ≥ target by endDate
// One-off: fixed start+end date. Repeating: per-period instances spawned lazily.
// net_worth_goal is always one-off.
export const challenge = pgTable("challenge", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => family.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: challengeTypeEnum("type").notNull(),
  repetition: challengeRepetitionEnum("repetition").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  customDurationDays: integer("custom_duration_days"),
  targetAmount: integer("target_amount").notNull(),
  accountId: uuid("account_id").references(() => financialAccount.id, {
    onDelete: "set null",
  }),
  debtId: uuid("debt_id").references(() => debt.id, {
    onDelete: "set null",
  }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

// Join table scoping a challenge to specific categories. A challenge may
// target multiple categories (e.g. "spend less on Groceries + Cafés"). Empty
// set is invalid for spend_less / pay_off_loan — at least one row required.
export const challengeCategory = pgTable(
  "challenge_category",
  {
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenge.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.challengeId, table.categoryId] })],
);

// Join table scoping a challenge to specific financial accounts. Empty set
// (no rows) means "all family accounts". Applies to spend_less and
// pay_off_loan where progress is the sum of expense transactions.
export const challengeAccount = pgTable(
  "challenge_account",
  {
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenge.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => financialAccount.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.challengeId, table.accountId] })],
);

export const challengeInstance = pgTable(
  "challenge_instance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenge.id, { onDelete: "cascade" }),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    status: challengeInstanceStatusEnum("status").default("active").notNull(),
    startingBalance: integer("starting_balance"),
    finalAmount: integer("final_amount"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("challenge_instance_challenge_idx").on(table.challengeId)],
);

// ── Relations ───────────────────────────────────────────────────────────────

export const challengeRelations = relations(challenge, ({ one, many }) => ({
  family: one(family, {
    fields: [challenge.familyId],
    references: [family.id],
  }),
  account: one(financialAccount, {
    fields: [challenge.accountId],
    references: [financialAccount.id],
  }),
  debt: one(debt, {
    fields: [challenge.debtId],
    references: [debt.id],
  }),
  instances: many(challengeInstance),
  accounts: many(challengeAccount),
  categories: many(challengeCategory),
}));

export const challengeCategoryRelations = relations(
  challengeCategory,
  ({ one }) => ({
    challenge: one(challenge, {
      fields: [challengeCategory.challengeId],
      references: [challenge.id],
    }),
    category: one(category, {
      fields: [challengeCategory.categoryId],
      references: [category.id],
    }),
  }),
);

export const challengeAccountRelations = relations(
  challengeAccount,
  ({ one }) => ({
    challenge: one(challenge, {
      fields: [challengeAccount.challengeId],
      references: [challenge.id],
    }),
    account: one(financialAccount, {
      fields: [challengeAccount.accountId],
      references: [financialAccount.id],
    }),
  }),
);

export const challengeInstanceRelations = relations(
  challengeInstance,
  ({ one }) => ({
    challenge: one(challenge, {
      fields: [challengeInstance.challengeId],
      references: [challenge.id],
    }),
  }),
);
