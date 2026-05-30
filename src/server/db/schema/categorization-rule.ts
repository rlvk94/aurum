import { relations } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { category } from "./category";
import { family } from "./family";

// ── Enums ───────────────────────────────────────────────────────────────────

export const categorizationRuleSourceEnum = pgEnum(
  "categorization_rule_source",
  ["seed", "user_correction", "user_create", "apply_to_similar"],
);

// ── Tables ──────────────────────────────────────────────────────────────────

/**
 * A learned merchant→category mapping for a family. Built up from how the user
 * actually categorizes their transactions (see `~/server/categorization/learn`)
 * and applied first during auto-categorization, ahead of keyword matching.
 *
 * One row per (family, merchantKey, categoryId): conflicting categories for the
 * same merchant coexist as separate rows so confidence is data (`hitCount`)
 * rather than a lossy overwrite. Rules store only merchant→category — never
 * amounts or which account — so they carry no sensitive financial detail.
 */
export const categorizationRule = pgTable(
  "categorization_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    merchantKey: text("merchant_key").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    /** Times the user has confirmed this merchant→category mapping. */
    hitCount: integer("hit_count").default(1).notNull(),
    /** Times a different category was chosen for this merchant (drift signal). */
    conflictCount: integer("conflict_count").default(0).notNull(),
    source: categorizationRuleSourceEnum("source")
      .default("user_correction")
      .notNull(),
    lastAppliedAt: timestamp("last_applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("categorization_rule_family_merchant_category_idx").on(
      table.familyId,
      table.merchantKey,
      table.categoryId,
    ),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────

export const categorizationRuleRelations = relations(
  categorizationRule,
  ({ one }) => ({
    family: one(family, {
      fields: [categorizationRule.familyId],
      references: [family.id],
    }),
    category: one(category, {
      fields: [categorizationRule.categoryId],
      references: [category.id],
    }),
  }),
);
