import { and, eq, inArray } from "drizzle-orm";

import type { db as dbInstance } from "~/server/db";
import { notificationPreference } from "~/server/db/schema";

import { CHANNELS, type ChannelId, type NotificationType } from "../constants";
import { defaultEnabled } from "./defaults";

export type PreferenceRow = {
  userId: string;
  channel: string;
  enabled: boolean;
};

export type ChannelEnabledMap = Record<ChannelId, boolean>;

/**
 * Pure merge of stored preference rows with type defaults. For each user and
 * each channel, the stored value wins; otherwise the type's default applies.
 * Extracted from the DB call so it can be unit-tested directly.
 */
export function resolveSubscriptionsFromRows(
  rows: PreferenceRow[],
  userIds: string[],
  type: NotificationType,
): Map<string, ChannelEnabledMap> {
  const stored = new Map<string, Map<string, boolean>>();
  for (const row of rows) {
    let byChannel = stored.get(row.userId);
    if (!byChannel) {
      byChannel = new Map();
      stored.set(row.userId, byChannel);
    }
    byChannel.set(row.channel, row.enabled);
  }

  const result = new Map<string, ChannelEnabledMap>();
  for (const userId of userIds) {
    const byChannel = stored.get(userId);
    const map = {} as ChannelEnabledMap;
    for (const channel of CHANNELS) {
      const storedValue = byChannel?.get(channel);
      map[channel] = storedValue ?? defaultEnabled(type, channel);
    }
    result.set(userId, map);
  }
  return result;
}

/**
 * Loads preference rows for the given users + type in one query and resolves
 * each user's per-channel enabled map (stored row ?? type default).
 */
export async function resolveSubscriptions(
  db: typeof dbInstance,
  userIds: string[],
  type: NotificationType,
): Promise<Map<string, ChannelEnabledMap>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({
      userId: notificationPreference.userId,
      channel: notificationPreference.channel,
      enabled: notificationPreference.enabled,
    })
    .from(notificationPreference)
    .where(
      and(
        inArray(notificationPreference.userId, userIds),
        eq(notificationPreference.type, type),
      ),
    );
  return resolveSubscriptionsFromRows(rows, userIds, type);
}
