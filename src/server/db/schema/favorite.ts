import { relations } from "drizzle-orm";
import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const userFavorite = pgTable(
  "user_favorite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    path: text("path").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_favorite_user_path_idx").on(table.userId, table.path),
  ],
);

export const userFavoriteRelations = relations(userFavorite, ({ one }) => ({
  user: one(user, {
    fields: [userFavorite.userId],
    references: [user.id],
  }),
}));
