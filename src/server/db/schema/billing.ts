import { relations } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { family } from "./family";

// ── Enums ───────────────────────────────────────────────────────────────────

export const familyPlanEnum = pgEnum("family_plan", ["individual", "family"]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "none",
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

export const billingCadenceEnum = pgEnum("billing_cadence", [
  "monthly",
  "annual",
]);

// ── Tables ──────────────────────────────────────────────────────────────────

export const familySubscription = pgTable("family_subscription", {
  familyId: uuid("family_id")
    .primaryKey()
    .references(() => family.id, { onDelete: "cascade" }),
  plan: familyPlanEnum("plan").default("individual").notNull(),
  status: subscriptionStatusEnum("status").default("none").notNull(),
  cadence: billingCadenceEnum("cadence"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripePriceId: text("stripe_price_id"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  graceEndsAt: timestamp("grace_ends_at", { withTimezone: true }),
  pendingCheckoutAt: timestamp("pending_checkout_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const stripeWebhookEvent = pgTable("stripe_webhook_event", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── Relations ───────────────────────────────────────────────────────────────

export const familySubscriptionRelations = relations(
  familySubscription,
  ({ one }) => ({
    family: one(family, {
      fields: [familySubscription.familyId],
      references: [family.id],
    }),
  }),
);
