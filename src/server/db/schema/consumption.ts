import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { family } from "./family";

// Consumption tracker (ADR-0026): manually read utility meters (electricity,
// water, gas, heat). `kind`, `unit` and the reminder `cadence` are `text`
// columns, not pgEnum — the valid sets live in src/lib/consumption-kinds.ts
// and are validated at the tRPC boundary (same approach as ADR-0025).

// ── Tables ──────────────────────────────────────────────────────────────────

// A physical meter the family reads by hand. Several meters per kind are
// allowed (two electricity meters, a summer house). `unit` is a display label
// chosen by the user (kWh, m³, MWh, GJ or custom) and `decimals` (0–3) is
// display precision only — values are always stored as milli-units.
export const consumptionMeter = pgTable(
  "consumption_meter",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    unit: text("unit").notNull(),
    decimals: integer("decimals").default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    archived: boolean("archived").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("consumption_meter_family_idx").on(table.familyId)],
);

// A cumulative reading: what the meter displayed on `date`. Consumption is
// never stored — it is derived as the difference between consecutive readings
// (src/server/lib/consumption.ts). `value` is in MILLI-UNITS (×1000) so three
// decimals fit in an integer; bigint because a 7-digit meter × 1000 overflows
// int4. Invariant enforced by the router: a non-reset reading is ≥ the
// previous reading by date. `isMeterReset` marks a replaced meter — the
// interval ending here has unknown consumption.
export const consumptionReading = pgTable(
  "consumption_reading",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meterId: uuid("meter_id")
      .notNull()
      .references(() => consumptionMeter.id, { onDelete: "cascade" }),
    familyId: uuid("family_id")
      .notNull()
      .references(() => family.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    value: bigint("value", { mode: "number" }).notNull(),
    isMeterReset: boolean("is_meter_reset").default(false).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    // One reading per meter per day; also serves ordered per-meter scans.
    uniqueIndex("consumption_reading_meter_date_idx").on(
      table.meterId,
      table.date,
    ),
    // Reminder sweep: "does the family have any reading dated today?"
    index("consumption_reading_family_date_idx").on(table.familyId, table.date),
  ],
);

// Family-level reminder settings. One row per family, created lazily on first
// save (familyId is the PK, like family_subscription). Both day-of-month and
// weekday are always present; only the one matching `reminderCadence` is
// consulted. dayOfMonth 31 clamps to the last day of shorter months.
export const consumptionSettings = pgTable("consumption_settings", {
  familyId: uuid("family_id")
    .primaryKey()
    .references(() => family.id, { onDelete: "cascade" }),
  reminderEnabled: boolean("reminder_enabled").default(false).notNull(),
  reminderCadence: text("reminder_cadence").default("monthly").notNull(),
  reminderDayOfMonth: integer("reminder_day_of_month").default(1).notNull(),
  reminderWeekday: integer("reminder_weekday").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── Relations ───────────────────────────────────────────────────────────────

export const consumptionMeterRelations = relations(
  consumptionMeter,
  ({ one, many }) => ({
    family: one(family, {
      fields: [consumptionMeter.familyId],
      references: [family.id],
    }),
    readings: many(consumptionReading),
  }),
);

export const consumptionReadingRelations = relations(
  consumptionReading,
  ({ one }) => ({
    meter: one(consumptionMeter, {
      fields: [consumptionReading.meterId],
      references: [consumptionMeter.id],
    }),
    family: one(family, {
      fields: [consumptionReading.familyId],
      references: [family.id],
    }),
  }),
);

export const consumptionSettingsRelations = relations(
  consumptionSettings,
  ({ one }) => ({
    family: one(family, {
      fields: [consumptionSettings.familyId],
      references: [family.id],
    }),
  }),
);
