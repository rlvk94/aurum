import "server-only";

import { and, eq } from "drizzle-orm";

import type { db as dbInstance } from "~/server/db";
import { notificationLog } from "~/server/db/schema";

import type { NotificationType } from "./constants";

/** UserIds that already have a log row for this (type, dedupeKey). */
export async function loadNotifiedUserIds(
  db: typeof dbInstance,
  type: NotificationType,
  dedupeKey: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ userId: notificationLog.userId })
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.type, type),
        eq(notificationLog.dedupeKey, dedupeKey),
      ),
    );
  return new Set(rows.map((r) => r.userId));
}

/** Records that a user was notified. Idempotent via the unique index. */
export async function recordNotified(
  db: typeof dbInstance,
  userId: string,
  type: NotificationType,
  dedupeKey: string,
): Promise<void> {
  await db
    .insert(notificationLog)
    .values({ userId, type, dedupeKey })
    .onConflictDoNothing({
      target: [
        notificationLog.userId,
        notificationLog.type,
        notificationLog.dedupeKey,
      ],
    });
}

/**
 * Clears all log rows for a (type, dedupeKey) — used to "re-arm" an episode
 * (e.g. a challenge returns on-track), so a later re-flip notifies again.
 * Returns the number of rows cleared.
 */
export async function clearEpisode(
  db: typeof dbInstance,
  type: NotificationType,
  dedupeKey: string,
): Promise<number> {
  const cleared = await db
    .delete(notificationLog)
    .where(
      and(
        eq(notificationLog.type, type),
        eq(notificationLog.dedupeKey, dedupeKey),
      ),
    )
    .returning({ userId: notificationLog.userId });
  return cleared.length;
}
