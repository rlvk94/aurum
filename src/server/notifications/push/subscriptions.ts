import "server-only";

import { eq } from "drizzle-orm";

import type { db as dbInstance } from "~/server/db";
import { pushSubscription } from "~/server/db/schema";

import type { StoredPushSubscription } from "../channels/types";

/** Loads a user's web-push subscriptions, shaped for the `web-push` library. */
export async function loadPushSubscriptions(
  db: typeof dbInstance,
  userId: string,
): Promise<StoredPushSubscription[]> {
  const rows = await db
    .select({
      endpoint: pushSubscription.endpoint,
      p256dh: pushSubscription.p256dh,
      auth: pushSubscription.auth,
    })
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));

  return rows.map((r) => ({
    endpoint: r.endpoint,
    keys: { p256dh: r.p256dh, auth: r.auth },
  }));
}
