import "server-only";
import { and, eq } from "drizzle-orm";

import type { db as dbInstance } from "~/server/db";
import {
  consumptionMeter,
  consumptionReading,
  consumptionSettings,
} from "~/server/db/schema";
import { REMINDER_CADENCES } from "~/lib/consumption-kinds";
import {
  isReminderDueToday,
  type ReminderSettings,
} from "~/server/lib/consumption";
import {
  dispatchNotification,
  loadNotifiedUserIds,
  resolveFamilyMembers,
  type ConsumptionReadingReminderPayload,
} from "~/server/notifications";

const TYPE = "consumption_reading_reminder" as const;

export type ConsumptionSweepResult = {
  familiesChecked: number;
  familiesDue: number;
  notified: number;
  skipped: number;
  errors: { familyId: string; message: string }[];
};

/**
 * Second step of the daily notification sweep (ADR-0026). For every family
 * with the reminder switched on and due today (Europe/Copenhagen date), notify
 * members about the active meters that still lack a reading dated today. The
 * date-stamped dedupe key guarantees one send per due date, so re-running the
 * cron is a no-op.
 */
export async function runConsumptionReminderSweep(
  db: typeof dbInstance,
  today: string,
): Promise<ConsumptionSweepResult> {
  const result: ConsumptionSweepResult = {
    familiesChecked: 0,
    familiesDue: 0,
    notified: 0,
    skipped: 0,
    errors: [],
  };

  const rows = await db
    .select()
    .from(consumptionSettings)
    .where(eq(consumptionSettings.reminderEnabled, true));

  for (const row of rows) {
    const familyId = row.familyId;
    try {
      result.familiesChecked++;
      const settings: ReminderSettings = {
        enabled: row.reminderEnabled,
        cadence: (REMINDER_CADENCES as readonly string[]).includes(
          row.reminderCadence,
        )
          ? (row.reminderCadence as ReminderSettings["cadence"])
          : "monthly",
        dayOfMonth: row.reminderDayOfMonth,
        weekday: row.reminderWeekday,
      };
      if (!isReminderDueToday(settings, today)) continue;
      result.familiesDue++;

      const meters = await db
        .select({ id: consumptionMeter.id, name: consumptionMeter.name })
        .from(consumptionMeter)
        .where(
          and(
            eq(consumptionMeter.familyId, familyId),
            eq(consumptionMeter.archived, false),
          ),
        )
        .orderBy(consumptionMeter.sortOrder, consumptionMeter.createdAt);
      if (meters.length === 0) {
        result.skipped++;
        continue;
      }

      const readToday = await db
        .select({ meterId: consumptionReading.meterId })
        .from(consumptionReading)
        .where(
          and(
            eq(consumptionReading.familyId, familyId),
            eq(consumptionReading.date, today),
          ),
        );
      const done = new Set(readToday.map((r) => r.meterId));
      const pending = meters.filter((m) => !done.has(m.id));
      if (pending.length === 0) {
        result.skipped++;
        continue;
      }

      const dedupeKey = `${TYPE}:${familyId}:${today}`;
      const recipients = await resolveFamilyMembers(db, familyId);
      const already = await loadNotifiedUserIds(db, TYPE, dedupeKey);
      const fresh = recipients.filter((r) => !already.has(r.userId));
      if (fresh.length === 0) continue;

      const payload: ConsumptionReadingReminderPayload = {
        familyId,
        dueDate: today,
        meterNames: pending.map((m) => m.name),
      };
      const summary = await dispatchNotification({
        type: TYPE,
        recipients: fresh,
        payload,
        dedupeKey,
      });
      result.notified += summary.notifiedUserIds.length;
      for (const e of summary.errors) {
        result.errors.push({
          familyId,
          message: `${e.channel}: ${e.message}`,
        });
      }
    } catch (err) {
      result.errors.push({
        familyId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
