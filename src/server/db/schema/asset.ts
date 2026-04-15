import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { family } from "./family";

// ── Enums ───────────────────────────────────────────────────────────────────

export const assetTypeEnum = pgEnum("asset_type", [
  "property",
  "vehicle",
  "investment",
  "collectible",
  "other",
]);

// ── Tables ──────────────────────────────────────────────────────────────────

export const asset = pgTable("asset", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => family.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: assetTypeEnum("type").notNull(),
  value: integer("value").default(0).notNull(),
  note: text("note"),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── Relations ───────────────────────────────────────────────────────────────

export const assetRelations = relations(asset, ({ one }) => ({
  family: one(family, {
    fields: [asset.familyId],
    references: [family.id],
  }),
}));
