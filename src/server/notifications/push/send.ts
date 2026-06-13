import "server-only";

import { eq } from "drizzle-orm";
import { WebPushError } from "web-push";

import { db } from "~/server/db";
import { pushSubscription } from "~/server/db/schema";

import type { StoredPushSubscription } from "../channels/types";
import { getWebPush } from "./web-push";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export type PushSendResult = { sent: number; pruned: number };

/**
 * Sends a push payload to every supplied subscription, pruning any that the
 * push service reports as gone (410) or not found (404). Returns counts. A dead
 * subscription is an expected outcome, not an error — it is deleted by endpoint.
 */
export async function sendWebPush(
  subscriptions: StoredPushSubscription[],
  payload: PushPayload,
): Promise<PushSendResult> {
  const client = getWebPush();
  if (!client) {
    console.log(
      `[DEV-PUSH] title="${payload.title}" to ${subscriptions.length} device(s) (VAPID not configured, skipping send)`,
    );
    return { sent: 0, pruned: 0 };
  }

  const json = JSON.stringify(payload);
  let sent = 0;
  let pruned = 0;

  for (const sub of subscriptions) {
    try {
      await client.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        },
        json,
      );
      sent++;
    } catch (err) {
      if (
        err instanceof WebPushError &&
        (err.statusCode === 410 || err.statusCode === 404)
      ) {
        await db
          .delete(pushSubscription)
          .where(eq(pushSubscription.endpoint, sub.endpoint));
        pruned++;
      } else {
        throw err;
      }
    }
  }

  return { sent, pruned };
}
