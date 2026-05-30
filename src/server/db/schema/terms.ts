import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { localeEnum, user } from "./auth";

// Append-only audit log of Terms & Conditions acceptances. The T&C text itself
// is bundled in `src/server/terms/`; on acceptance we snapshot the EXACT text
// the user agreed to (verbatim `content` + `contentHash`), the `version`, the
// `locale` they read it in, and the precise `acceptedAt` time — for
// documentation/legal purposes.
//
// One row per (user, version): the unique index makes accept idempotent, while
// still allowing multiple rows per user once additional versions ship (future
// "re-consent on change" flow). Never mutate rows.
export const termsAcceptance = pgTable(
  "terms_acceptance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Bundled terms version id (e.g. "2026-05-30").
    version: text("version").notNull(),
    // Locale the user read and accepted the terms in.
    locale: localeEnum("locale").notNull(),
    // SHA-256 (hex) of the exact accepted text — integrity proof.
    contentHash: text("content_hash").notNull(),
    // Verbatim full-text snapshot of the accepted terms.
    content: text("content").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("terms_acceptance_user_version_uidx").on(
      table.userId,
      table.version,
    ),
    index("terms_acceptance_user_idx").on(table.userId),
  ],
);

export const termsAcceptanceRelations = relations(
  termsAcceptance,
  ({ one }) => ({
    user: one(user, {
      fields: [termsAcceptance.userId],
      references: [user.id],
    }),
  }),
);
