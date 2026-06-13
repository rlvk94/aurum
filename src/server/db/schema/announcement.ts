import { relations } from "drizzle-orm";
import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

// Per-user, per-announcement read state. The announcement content itself is
// bundled in `src/server/announcements/`; this table only records which user
// has dismissed which announcement (by slug id) and when.
export const announcementDismissal = pgTable(
  "announcement_dismissal",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    announcementId: text("announcement_id").notNull(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.announcementId] })],
);

export const announcementDismissalRelations = relations(
  announcementDismissal,
  ({ one }) => ({
    user: one(user, {
      fields: [announcementDismissal.userId],
      references: [user.id],
    }),
  }),
);
