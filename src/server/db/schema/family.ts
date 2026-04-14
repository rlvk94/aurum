import { relations } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { financialAccount } from "./financial-account";

// ── Enums ───────────────────────────────────────────────────────────────────

export const familyRoleEnum = pgEnum("family_role", ["owner", "member"]);

// ── Tables ──────────────────────────────────────────────────────────────────

export const family = pgTable("family", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const usersToFamilies = pgTable(
  "users_to_families",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    role: familyRoleEnum("role").default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.familyId] })],
);

export const invitation = pgTable("invitation", {
  id: uuid("id").primaryKey().defaultRandom(),
  familyId: uuid("family_id")
    .notNull()
    .references(() => family.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  invitedById: text("invited_by_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── Relations ───────────────────────────────────────────────────────────────

export const familyRelations = relations(family, ({ many }) => ({
  usersToFamilies: many(usersToFamilies),
  invitations: many(invitation),
  financialAccounts: many(financialAccount),
}));

export const usersToFamiliesRelations = relations(
  usersToFamilies,
  ({ one }) => ({
    user: one(user, {
      fields: [usersToFamilies.userId],
      references: [user.id],
    }),
    family: one(family, {
      fields: [usersToFamilies.familyId],
      references: [family.id],
    }),
  }),
);

export const invitationRelations = relations(invitation, ({ one }) => ({
  family: one(family, {
    fields: [invitation.familyId],
    references: [family.id],
  }),
  invitedBy: one(user, {
    fields: [invitation.invitedById],
    references: [user.id],
  }),
}));
