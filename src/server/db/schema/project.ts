import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { family } from "./family";

// A Project groups transactions across categories and accounts under a single
// endeavor (vacation, renovation, wedding). Independent of categories: a
// transaction may belong to one project regardless of its category. Both
// expense and income transactions can be tagged; the project total is the
// net (sum of expenses − sum of incomes).
export const project = pgTable(
  "project",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // Single emoji grapheme used as a glyph on the cover band.
    emoji: text("emoji").default("📌").notNull(),
    // Palette key. The eight curated palettes live in the UI layer; the
    // server stores the key only so palette tweaks stay in CSS.
    coverPalette: text("cover_palette").default("gold").notNull(),
    // Optional spending limit in cents. Null = no limit (just a tracker).
    spendingLimit: integer("spending_limit"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("project_family_idx").on(table.familyId, table.archivedAt)],
);

export const projectRelations = relations(project, ({ one }) => ({
  family: one(family, {
    fields: [project.familyId],
    references: [family.id],
  }),
}));
