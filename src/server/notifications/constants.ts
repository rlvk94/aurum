/**
 * The open sets of channels and notification types. These are the single
 * source of truth — the DB stores them as `text` (see ADR-0025), and they are
 * validated against these arrays at the tRPC boundary. Adding a channel or type
 * is a code change here plus a registry entry; no migration required.
 */

export const CHANNELS = ["email", "push"] as const;
export type ChannelId = (typeof CHANNELS)[number];

export const NOTIFICATION_TYPES = [
  "challenge_off_track",
  "consumption_reading_reminder",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isChannelId(value: string): value is ChannelId {
  return (CHANNELS as readonly string[]).includes(value);
}

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}
