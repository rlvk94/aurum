import { relations } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { family } from "./family";

// ── Enums ───────────────────────────────────────────────────────────────────

export const categoryKindEnum = pgEnum("category_kind", ["expense", "income"]);

// ── Tables ──────────────────────────────────────────────────────────────────

export const category = pgTable(
  "category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => category.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    kind: categoryKindEnum("kind").notNull(),
    icon: text("icon"),
    archived: boolean("archived").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("category_family_parent_name_idx").on(
      table.familyId,
      table.parentId,
      table.name,
    ),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────

export const categoryRelations = relations(category, ({ one, many }) => ({
  family: one(family, {
    fields: [category.familyId],
    references: [family.id],
  }),
  parent: one(category, {
    fields: [category.parentId],
    references: [category.id],
    relationName: "parentChild",
  }),
  children: many(category, { relationName: "parentChild" }),
}));
