import type { Locale } from "~/i18n/config";

import type { ChannelId, NotificationType } from "../constants";
import type { RenderedMessage } from "../channels/types";

export type NotificationRecipient = {
  userId: string;
  email: string;
  locale: Locale;
};

export type RenderContext<Payload> = {
  recipient: NotificationRecipient;
  payload: Payload;
  locale: Locale;
};

/**
 * A notification type: who it can reach (channels), the default per-channel
 * opt-in for users with no stored preference, and how to render it per channel
 * per locale. Returning null from `render` skips that channel.
 */
export interface NotificationDefinition<Payload = unknown> {
  readonly type: NotificationType;
  readonly channels: readonly ChannelId[];
  readonly defaults: Record<ChannelId, boolean>;
  render(
    channel: ChannelId,
    ctx: RenderContext<Payload>,
  ): Promise<RenderedMessage | null>;
}
