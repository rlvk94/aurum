/**
 * Shared contract for the consumption tracker's meters. Pure constants — no
 * React, no server-only imports — so the Drizzle schema comments, the tRPC
 * router (zod enums), the maths lib and the UI all read the same values.
 *
 * `kind`, `unit` and reminder `cadence` are stored as `text` columns, not
 * pgEnum (ADR-0025 / ADR-0026): the valid sets live here and are validated at
 * the tRPC boundary, so growing them is a code change without a migration.
 */

export const METER_KINDS = [
  "electricity",
  "water",
  "gas",
  "heat",
  "other",
] as const;
export type MeterKind = (typeof METER_KINDS)[number];

/** Suggested units in the meter form. Any short string is accepted. */
export const METER_UNIT_PRESETS = ["kWh", "m³", "MWh", "GJ"] as const;

export const METER_MAX_DECIMALS = 3;
export const METER_UNIT_MAX_LENGTH = 16;

/** Defaults applied when a kind is picked while creating a meter. */
export const KIND_DEFAULTS: Record<
  MeterKind,
  { unit: string; decimals: number }
> = {
  electricity: { unit: "kWh", decimals: 0 },
  water: { unit: "m³", decimals: 3 },
  gas: { unit: "m³", decimals: 2 },
  heat: { unit: "MWh", decimals: 3 },
  other: { unit: "", decimals: 1 },
};

export const REMINDER_CADENCES = ["monthly", "weekly"] as const;
export type ReminderCadence = (typeof REMINDER_CADENCES)[number];

/**
 * Reading values are stored as integer milli-units (×1000) so three decimals
 * fit without a `numeric` column — the same "integer with documented scale"
 * rule the codebase uses for øre and basis points.
 */
export const VALUE_SCALE = 1000;

export function toMilli(units: number): number {
  return Math.round(units * VALUE_SCALE);
}

export function fromMilli(milli: number): number {
  return milli / VALUE_SCALE;
}
