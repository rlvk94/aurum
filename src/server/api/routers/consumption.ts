import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { db as dbInstance } from "~/server/db";
import {
  consumptionMeter,
  consumptionReading,
  consumptionSettings,
  user,
} from "~/server/db/schema";
import {
  METER_KINDS,
  METER_MAX_DECIMALS,
  METER_UNIT_MAX_LENGTH,
  REMINDER_CADENCES,
  type ReminderCadence,
} from "~/lib/consumption-kinds";
import {
  DEFAULT_REMINDER_SETTINGS,
  bucketByMonth,
  buildIntervals,
  copenhagenToday,
  findLastCompleteMonth,
  isReadingOverdue,
  nextDueDate,
  sortReadings,
  summarizeYears,
  validateReadingSequence,
  type MonthBucket,
  type ReadingLike,
  type ReminderSettings,
} from "~/server/lib/consumption";

// ── Validation ──────────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Milli-units (×1000). 999,999,999.999 units — far beyond any household meter
// but comfortably inside Number.MAX_SAFE_INTEGER.
const valueSchema = z.number().int().min(0).max(999_999_999_999);
const noteSchema = z.string().trim().max(500);

const meterShape = {
  name: z.string().trim().min(1).max(60),
  kind: z.enum(METER_KINDS),
  // Empty is allowed for "other" meters that count something unit-less.
  unit: z.string().trim().max(METER_UNIT_MAX_LENGTH),
  decimals: z.number().int().min(0).max(METER_MAX_DECIMALS),
};

const settingsPatchSchema = z.object({
  enabled: z.boolean().optional(),
  cadence: z.enum(REMINDER_CADENCES).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  weekday: z.number().int().min(1).max(7).optional(),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

type DbOrTx =
  | Parameters<Parameters<typeof dbInstance.transaction>[0]>[0]
  | typeof dbInstance;

type MeterRow = typeof consumptionMeter.$inferSelect;
type ReadingRow = typeof consumptionReading.$inferSelect;

async function getActiveFamilyId(db: typeof dbInstance, userId: string) {
  const [dbUser] = await db
    .select({ activeFamilyId: user.activeFamilyId })
    .from(user)
    .where(eq(user.id, userId));

  if (!dbUser?.activeFamilyId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active family",
    });
  }
  return dbUser.activeFamilyId;
}

async function loadMeterInFamily(
  db: DbOrTx,
  meterId: string,
  familyId: string,
): Promise<MeterRow> {
  const [row] = await db
    .select()
    .from(consumptionMeter)
    .where(
      and(
        eq(consumptionMeter.id, meterId),
        eq(consumptionMeter.familyId, familyId),
      ),
    );
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Meter not found" });
  }
  return row;
}

async function loadReadingInFamily(
  db: DbOrTx,
  readingId: string,
  familyId: string,
): Promise<ReadingRow> {
  const [row] = await db
    .select()
    .from(consumptionReading)
    .where(
      and(
        eq(consumptionReading.id, readingId),
        eq(consumptionReading.familyId, familyId),
      ),
    );
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Reading not found" });
  }
  return row;
}

async function loadMeterReadings(
  db: DbOrTx,
  meterId: string,
): Promise<ReadingRow[]> {
  return db
    .select()
    .from(consumptionReading)
    .where(eq(consumptionReading.meterId, meterId))
    .orderBy(asc(consumptionReading.date));
}

function isCadence(value: string): value is ReminderCadence {
  return (REMINDER_CADENCES as readonly string[]).includes(value);
}

async function loadSettings(
  db: DbOrTx,
  familyId: string,
): Promise<ReminderSettings> {
  const [row] = await db
    .select()
    .from(consumptionSettings)
    .where(eq(consumptionSettings.familyId, familyId));
  if (!row) return DEFAULT_REMINDER_SETTINGS;
  return {
    enabled: row.reminderEnabled,
    cadence: isCadence(row.reminderCadence) ? row.reminderCadence : "monthly",
    dayOfMonth: row.reminderDayOfMonth,
    weekday: row.reminderWeekday,
  };
}

function toReadingLike(r: ReadingRow): ReadingLike {
  return {
    id: r.id,
    date: r.date,
    value: r.value,
    isMeterReset: r.isMeterReset,
  };
}

function publicReading(r: ReadingRow) {
  return {
    id: r.id,
    date: r.date,
    value: r.value,
    isMeterReset: r.isMeterReset,
    note: r.note,
  };
}

/**
 * Enforce the single sequence invariant on a proposed reading list. Throws a
 * stable message key the UI translates.
 */
function assertSequence(proposed: ReadingLike[], meterId: string): void {
  const violation = validateReadingSequence(proposed);
  if (violation) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "reading_below_previous",
      cause: { meterId, ...violation },
    });
  }
}

function assertNoReadingOnDate(
  readings: ReadingRow[],
  date: string,
  exceptId?: string,
): void {
  if (readings.some((r) => r.date === date && r.id !== exceptId)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "reading_exists_for_date",
    });
  }
}

/** Per-meter derived fields shared by list, detail and dashboard. */
function enrichMeter(
  rows: ReadingRow[],
  settings: ReminderSettings,
  today: string,
  archived: boolean,
) {
  const sorted = sortReadings(rows);
  const latest = sorted.at(-1) ?? null;
  const previous = sorted.at(-2) ?? null;
  const intervals = buildIntervals(sorted.map(toReadingLike));
  const lastInterval = intervals.at(-1) ?? null;
  const thisYear = Number(today.slice(0, 4));
  const months = bucketByMonth(intervals, thisYear - 1, thisYear);
  return {
    latestReading: latest ? publicReading(latest) : null,
    previousReading: previous ? publicReading(previous) : null,
    lastInterval,
    isOverdue: archived
      ? false
      : isReadingOverdue(settings, latest?.date ?? null, today),
    lastCompleteMonth: findLastCompleteMonth(months, today),
  };
}

// ── Router ──────────────────────────────────────────────────────────────────

export const consumptionRouter = createTRPCRouter({
  listMeters: protectedProcedure
    .input(z.object({ includeArchived: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const today = copenhagenToday();
      const settings = await loadSettings(ctx.db, familyId);

      const conditions = [eq(consumptionMeter.familyId, familyId)];
      if (!input?.includeArchived) {
        conditions.push(eq(consumptionMeter.archived, false));
      }
      const meters = await ctx.db
        .select()
        .from(consumptionMeter)
        .where(and(...conditions))
        .orderBy(
          asc(consumptionMeter.archived),
          asc(consumptionMeter.sortOrder),
          asc(consumptionMeter.createdAt),
        );
      if (meters.length === 0) return [];

      // One readings query for the whole family, grouped in JS.
      const readings = await ctx.db
        .select()
        .from(consumptionReading)
        .where(eq(consumptionReading.familyId, familyId))
        .orderBy(asc(consumptionReading.date));
      const byMeter = new Map<string, ReadingRow[]>();
      for (const r of readings) {
        const list = byMeter.get(r.meterId) ?? [];
        list.push(r);
        byMeter.set(r.meterId, list);
      }

      return meters.map((m) => ({
        ...m,
        ...enrichMeter(byMeter.get(m.id) ?? [], settings, today, m.archived),
      }));
    }),

  getMeter: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const meter = await loadMeterInFamily(ctx.db, input.id, familyId);
      const rows = await loadMeterReadings(ctx.db, meter.id);
      const settings = await loadSettings(ctx.db, familyId);
      const today = copenhagenToday();

      const thisYear = Number(today.slice(0, 4));
      const firstYear = rows[0] ? Number(rows[0].date.slice(0, 4)) : thisYear;
      const intervals = buildIntervals(rows.map(toReadingLike));

      // Compute one extra year back so the first visible year has a YoY
      // comparison, then drop it from the payload.
      const allMonths = bucketByMonth(intervals, firstYear - 1, thisYear);
      const months: Record<number, MonthBucket[]> = {};
      for (let y = firstYear; y <= thisYear; y++) months[y] = allMonths[y]!;
      const years = summarizeYears(allMonths).filter(
        (y) => y.year >= firstYear,
      );

      const byToId = new Map(intervals.map((iv) => [iv.toReadingId, iv]));
      const readings = [...rows].reverse().map((r) => {
        const iv = byToId.get(r.id);
        return {
          ...publicReading(r),
          consumption: iv?.consumption ?? null,
          perDay: iv?.perDay ?? null,
          days: iv?.days ?? null,
        };
      });

      return {
        ...meter,
        ...enrichMeter(rows, settings, today, meter.archived),
        readings,
        months,
        years,
      };
    }),

  createMeter: protectedProcedure
    .input(z.object(meterShape))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const [orderRow] = await ctx.db
        .select({
          maxOrder: sql<number>`coalesce(max(${consumptionMeter.sortOrder}), -1)`,
        })
        .from(consumptionMeter)
        .where(eq(consumptionMeter.familyId, familyId));

      const [created] = await ctx.db
        .insert(consumptionMeter)
        .values({
          familyId,
          name: input.name,
          kind: input.kind,
          unit: input.unit,
          decimals: input.decimals,
          sortOrder: Number(orderRow?.maxOrder ?? -1) + 1,
        })
        .returning();
      if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return created;
    }),

  updateMeter: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: meterShape.name.optional(),
        kind: meterShape.kind.optional(),
        unit: meterShape.unit.optional(),
        decimals: meterShape.decimals.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const { id, ...patch } = input;
      await loadMeterInFamily(ctx.db, id, familyId);
      await ctx.db
        .update(consumptionMeter)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(consumptionMeter.id, id));
    }),

  setMeterArchived: protectedProcedure
    .input(z.object({ id: z.string().uuid(), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await loadMeterInFamily(ctx.db, input.id, familyId);
      await ctx.db
        .update(consumptionMeter)
        .set({ archived: input.archived, updatedAt: new Date() })
        .where(eq(consumptionMeter.id, input.id));
    }),

  deleteMeter: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      // Readings cascade.
      await ctx.db
        .delete(consumptionMeter)
        .where(
          and(
            eq(consumptionMeter.id, input.id),
            eq(consumptionMeter.familyId, familyId),
          ),
        );
    }),

  createReading: protectedProcedure
    .input(
      z.object({
        meterId: z.string().uuid(),
        date: isoDate,
        value: valueSchema,
        isMeterReset: z.boolean().optional(),
        note: noteSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      return await ctx.db.transaction(async (tx) => {
        await loadMeterInFamily(tx, input.meterId, familyId);
        const existing = await loadMeterReadings(tx, input.meterId);
        assertNoReadingOnDate(existing, input.date);
        const proposed: ReadingLike = {
          id: "new",
          date: input.date,
          value: input.value,
          isMeterReset: input.isMeterReset ?? false,
        };
        assertSequence(
          [...existing.map(toReadingLike), proposed],
          input.meterId,
        );

        const [created] = await tx
          .insert(consumptionReading)
          .values({
            meterId: input.meterId,
            familyId,
            date: input.date,
            value: input.value,
            isMeterReset: input.isMeterReset ?? false,
            note: input.note?.length ? input.note : null,
          })
          .returning();
        if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return created;
      });
    }),

  updateReading: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        date: isoDate.optional(),
        value: valueSchema.optional(),
        isMeterReset: z.boolean().optional(),
        note: noteSchema.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await ctx.db.transaction(async (tx) => {
        const row = await loadReadingInFamily(tx, input.id, familyId);
        const existing = await loadMeterReadings(tx, row.meterId);

        const nextDate = input.date ?? row.date;
        if (nextDate !== row.date) {
          assertNoReadingOnDate(existing, nextDate, row.id);
        }
        const merged: ReadingLike = {
          id: row.id,
          date: nextDate,
          value: input.value ?? row.value,
          isMeterReset: input.isMeterReset ?? row.isMeterReset,
        };
        const proposed = existing
          .filter((r) => r.id !== row.id)
          .map(toReadingLike);
        proposed.push(merged);
        assertSequence(proposed, row.meterId);

        await tx
          .update(consumptionReading)
          .set({
            date: merged.date,
            value: merged.value,
            isMeterReset: merged.isMeterReset,
            ...(input.note !== undefined
              ? {
                  note: input.note && input.note.length > 0 ? input.note : null,
                }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(consumptionReading.id, row.id));
      });
    }),

  deleteReading: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      await ctx.db.transaction(async (tx) => {
        const row = await loadReadingInFamily(tx, input.id, familyId);
        const existing = await loadMeterReadings(tx, row.meterId);
        const remaining = existing
          .filter((r) => r.id !== row.id)
          .map(toReadingLike);
        // Removing a reset reading between a high old value and a low new one
        // would leave a decrease. Ask the user to flag the next reading first.
        if (validateReadingSequence(remaining)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "delete_breaks_sequence",
          });
        }
        await tx
          .delete(consumptionReading)
          .where(eq(consumptionReading.id, row.id));
      });
    }),

  // The "Aflæs målere" flow: one date, one value per active meter. Every row is
  // validated first so the dialog can mark all bad fields at once; then a
  // single upsert on (meter_id, date) so re-entering today's readings updates
  // in place.
  bulkUpsertReadings: protectedProcedure
    .input(
      z.object({
        date: isoDate,
        rows: z
          .array(
            z.object({
              meterId: z.string().uuid(),
              value: valueSchema,
              isMeterReset: z.boolean().optional(),
            }),
          )
          .min(1)
          .max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const meterIds = input.rows.map((r) => r.meterId);
      if (new Set(meterIds).size !== meterIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "duplicate_meter_in_rows",
        });
      }

      return await ctx.db.transaction(async (tx) => {
        const meters = await tx
          .select()
          .from(consumptionMeter)
          .where(
            and(
              eq(consumptionMeter.familyId, familyId),
              inArray(consumptionMeter.id, meterIds),
            ),
          );
        if (meters.length !== meterIds.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Meter not found",
          });
        }
        if (meters.some((m) => m.archived)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "meter_archived",
          });
        }

        const failures: { meterId: string; reason: string }[] = [];
        for (const row of input.rows) {
          const existing = await loadMeterReadings(tx, row.meterId);
          const proposed = existing
            .filter((r) => r.date !== input.date)
            .map(toReadingLike);
          proposed.push({
            id: `new:${row.meterId}`,
            date: input.date,
            value: row.value,
            isMeterReset: row.isMeterReset ?? false,
          });
          if (validateReadingSequence(proposed)) {
            failures.push({
              meterId: row.meterId,
              reason: "reading_below_previous",
            });
          }
        }
        if (failures.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "bulk_validation_failed",
            cause: { failures },
          });
        }

        await tx
          .insert(consumptionReading)
          .values(
            input.rows.map((row) => ({
              meterId: row.meterId,
              familyId,
              date: input.date,
              value: row.value,
              isMeterReset: row.isMeterReset ?? false,
            })),
          )
          .onConflictDoUpdate({
            target: [consumptionReading.meterId, consumptionReading.date],
            set: {
              value: sql`excluded.value`,
              isMeterReset: sql`excluded.is_meter_reset`,
              updatedAt: new Date(),
            },
          });

        return { upserted: input.rows.length, date: input.date };
      });
    }),

  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    return loadSettings(ctx.db, familyId);
  }),

  updateSettings: protectedProcedure
    .input(settingsPatchSchema)
    .mutation(async ({ ctx, input }) => {
      const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
      const current = await loadSettings(ctx.db, familyId);
      const merged: ReminderSettings = {
        enabled: input.enabled ?? current.enabled,
        cadence: input.cadence ?? current.cadence,
        dayOfMonth: input.dayOfMonth ?? current.dayOfMonth,
        weekday: input.weekday ?? current.weekday,
      };
      const values = {
        reminderEnabled: merged.enabled,
        reminderCadence: merged.cadence,
        reminderDayOfMonth: merged.dayOfMonth,
        reminderWeekday: merged.weekday,
      };
      await ctx.db
        .insert(consumptionSettings)
        .values({ familyId, ...values })
        .onConflictDoUpdate({
          target: consumptionSettings.familyId,
          set: { ...values, updatedAt: new Date() },
        });
      return merged;
    }),

  // Dashboard widget: active meters with their latest state.
  summary: protectedProcedure.query(async ({ ctx }) => {
    const familyId = await getActiveFamilyId(ctx.db, ctx.session.user.id);
    const today = copenhagenToday();
    const settings = await loadSettings(ctx.db, familyId);

    const meters = await ctx.db
      .select()
      .from(consumptionMeter)
      .where(
        and(
          eq(consumptionMeter.familyId, familyId),
          eq(consumptionMeter.archived, false),
        ),
      )
      .orderBy(
        asc(consumptionMeter.sortOrder),
        asc(consumptionMeter.createdAt),
      );

    const readings =
      meters.length === 0
        ? []
        : await ctx.db
            .select()
            .from(consumptionReading)
            .where(eq(consumptionReading.familyId, familyId))
            .orderBy(asc(consumptionReading.date));
    const byMeter = new Map<string, ReadingRow[]>();
    for (const r of readings) {
      const list = byMeter.get(r.meterId) ?? [];
      list.push(r);
      byMeter.set(r.meterId, list);
    }

    const items = meters.map((m) => {
      const e = enrichMeter(byMeter.get(m.id) ?? [], settings, today, false);
      return {
        id: m.id,
        name: m.name,
        kind: m.kind,
        unit: m.unit,
        decimals: m.decimals,
        latestReadingDate: e.latestReading?.date ?? null,
        lastIntervalPerDay: e.lastInterval?.perDay ?? null,
        lastCompleteMonth: e.lastCompleteMonth,
        isOverdue: e.isOverdue,
      };
    });

    return {
      meters: items,
      overdueCount: items.filter((m) => m.isOverdue).length,
      reminder: {
        enabled: settings.enabled,
        nextDueDate: settings.enabled ? nextDueDate(settings, today) : null,
      },
    };
  }),
});
