import "server-only";

import webpush from "web-push";

import { env } from "~/env";

let configured = false;

/** Whether all VAPID keys are present. */
export function isPushConfigured(): boolean {
  return Boolean(
    env.VAPID_PRIVATE_KEY &&
    env.VAPID_SUBJECT &&
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  );
}

/**
 * Returns the configured `web-push` client, or null when VAPID keys are absent
 * (dev fallback). Sets VAPID details once on first use.
 */
export function getWebPush(): typeof webpush | null {
  if (!isPushConfigured()) return null;
  if (!configured) {
    webpush.setVapidDetails(
      env.VAPID_SUBJECT!,
      env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      env.VAPID_PRIVATE_KEY!,
    );
    configured = true;
  }
  return webpush;
}
