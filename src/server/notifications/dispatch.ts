import "server-only";

import { db } from "~/server/db";

import { channelRegistry } from "./channels/registry";
import type { ChannelTarget } from "./channels/types";
import type { ChannelId, NotificationType } from "./constants";
import { recordNotified } from "./dedupe";
import { getDefinition } from "./definitions/registry";
import type { NotificationRecipient } from "./definitions/types";
import { resolveSubscriptions } from "./preferences/resolve";
import { loadPushSubscriptions } from "./push/subscriptions";

export type DispatchSummary = {
  /** UserIds that received at least one channel delivery. */
  notifiedUserIds: string[];
  delivered: number;
  pruned: number;
  errors: { userId: string; channel: ChannelId; message: string }[];
};

async function resolveTarget(
  recipient: NotificationRecipient,
  channel: ChannelId,
): Promise<ChannelTarget> {
  if (channel === "push") {
    return {
      channel: "push",
      subscriptions: await loadPushSubscriptions(db, recipient.userId),
    };
  }
  return { channel: "email", email: recipient.email };
}

/**
 * Delivers a notification to each recipient via every channel they're
 * subscribed to (and that's configured). One channel/recipient failure never
 * aborts the rest. When `dedupeKey` is set, recipients who received at least
 * one delivery are recorded in `notification_log`.
 */
export async function dispatchNotification<Payload>(args: {
  type: NotificationType;
  recipients: NotificationRecipient[];
  payload: Payload;
  dedupeKey?: string;
}): Promise<DispatchSummary> {
  const { type, recipients, payload, dedupeKey } = args;
  const definition = getDefinition(type);
  const summary: DispatchSummary = {
    notifiedUserIds: [],
    delivered: 0,
    pruned: 0,
    errors: [],
  };
  if (recipients.length === 0) return summary;

  const subscriptions = await resolveSubscriptions(
    db,
    recipients.map((r) => r.userId),
    type,
  );

  for (const recipient of recipients) {
    const enabledMap = subscriptions.get(recipient.userId);
    let deliveredForUser = false;

    for (const channel of definition.channels) {
      if (!enabledMap?.[channel]) continue;
      const adapter = channelRegistry[channel];
      if (!adapter.isConfigured()) continue;

      try {
        const target = await resolveTarget(recipient, channel);
        const message = await definition.render(channel, {
          recipient,
          payload,
          locale: recipient.locale,
        });
        if (!message) continue;

        // The discriminant `channel` lines up by construction; cast narrows the
        // union for the channel-specific adapter signature.
        const result = await adapter.deliver(target as never, message as never);
        summary.pruned += result.pruned ?? 0;
        if (result.ok) {
          summary.delivered++;
          deliveredForUser = true;
        }
      } catch (err) {
        summary.errors.push({
          userId: recipient.userId,
          channel,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (deliveredForUser) {
      summary.notifiedUserIds.push(recipient.userId);
      if (dedupeKey) {
        await recordNotified(db, recipient.userId, type, dedupeKey).catch(
          (err) => {
            console.error("[notifications] failed to record dedupe log", err);
          },
        );
      }
    }
  }

  return summary;
}
