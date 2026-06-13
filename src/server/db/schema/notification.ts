import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

// Notification `type` and `channel` are stored as `text`, NOT pgEnum: the sets
// grow often (new event types, new channels like sms/slack) and an enum would
// force a migration on every addition. Valid values are owned by the code-level
// const arrays in `src/server/notifications/constants.ts` and validated at the
// tRPC boundary. See ADR-0025.

// ── Tables ──────────────────────────────────────────────────────────────────

// A web-push subscription for one device/browser. One user → many devices.
// Keyed by a unique `endpoint`; re-subscribing the same device upserts. Dead
// subscriptions (410 Gone / 404 from the push service) are pruned on send.
export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("push_subscription_endpoint_idx").on(table.endpoint),
    index("push_subscription_user_idx").on(table.userId),
  ],
);

// Per-user, per-type, per-channel opt-in/out. SPARSE: a row exists only when a
// user deviates from the type's declared default. Resolution is
// `enabled = storedRow?.enabled ?? definition.defaults[channel]`.
export const notificationPreference = pgTable(
  "notification_preference",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    channel: text("channel").notNull(),
    enabled: boolean("enabled").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.type, table.channel] }),
  ],
);

// Dedupe / audit log. One row per (user, type, dedupeKey) we've actually fired.
// The unique index makes concurrent/duplicate cron runs idempotent. For
// challenge_off_track the dedupeKey is `challenge_off_track:{instanceId}` and a
// row is deleted on recovery to re-arm the next off-track episode.
export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("notification_log_dedupe_idx").on(
      table.userId,
      table.type,
      table.dedupeKey,
    ),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────

export const pushSubscriptionRelations = relations(
  pushSubscription,
  ({ one }) => ({
    user: one(user, {
      fields: [pushSubscription.userId],
      references: [user.id],
    }),
  }),
);

export const notificationPreferenceRelations = relations(
  notificationPreference,
  ({ one }) => ({
    user: one(user, {
      fields: [notificationPreference.userId],
      references: [user.id],
    }),
  }),
);
