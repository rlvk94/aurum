import type { ChannelId } from "../constants";

/** A stored web-push subscription, shaped for the `web-push` library. */
export type StoredPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/**
 * Where a rendered message lands, per channel. Resolved by the dispatcher from
 * the recipient (email address from the user row; push subscriptions loaded
 * from `push_subscription`).
 */
export type ChannelTarget =
  | { channel: "email"; email: string }
  | { channel: "push"; subscriptions: StoredPushSubscription[] };

/** Channel-specific rendered payloads, discriminated by `channel`. */
export type RenderedMessage =
  | { channel: "email"; subject: string; html: string }
  | { channel: "push"; title: string; body: string; url: string; tag: string };

export type DeliveryResult = {
  ok: boolean;
  /** Number of dead push subscriptions pruned during delivery. */
  pruned?: number;
  /** Whether nothing was sent because there was no target (e.g. no devices). */
  skipped?: boolean;
  error?: string;
};

/**
 * A delivery channel. Implementations are thin adapters over a transport
 * (email provider, web-push). `deliver` must not throw for *expected* failures
 * (e.g. a 410 Gone push subscription) — it prunes and reports via the result.
 */
export interface Channel<C extends ChannelId = ChannelId> {
  readonly id: C;
  /** Whether the underlying transport is configured (keys present). */
  isConfigured(): boolean;
  deliver(
    target: Extract<ChannelTarget, { channel: C }>,
    message: Extract<RenderedMessage, { channel: C }>,
  ): Promise<DeliveryResult>;
}
