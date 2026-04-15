import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { category } from "./category";
import { family } from "./family";

export const categorizationRule = pgTable("categorization_rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => family.id, { onDelete: "cascade" }),
  pattern: text("pattern").notNull(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => category.id, { onDelete: "cascade" }),
  priority: integer("priority").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

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
