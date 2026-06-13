import "server-only";

import type { ChannelId } from "../constants";
import { emailChannel } from "./email-channel";
import { pushChannel } from "./push-channel";
import type { Channel } from "./types";

// Each key maps to its own narrowed channel (Channel<"email">, Channel<"push">)
// rather than the contravariant Channel<ChannelId>, so the literal adapters fit.
type ChannelRegistry = { [K in ChannelId]: Channel<K> };

export const channelRegistry: ChannelRegistry = {
  email: emailChannel,
  push: pushChannel,
};
