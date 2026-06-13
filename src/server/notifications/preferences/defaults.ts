import type { ChannelId, NotificationType } from "../constants";
import { definitionRegistry } from "../definitions/registry";

/**
 * The default opt-in for a (type, channel) when the user has no stored
 * preference row. Sourced from each notification definition — the definition is
 * the single source of truth for its own defaults. A channel not listed in the
 * definition's `channels` defaults to false (the type can't use it).
 */
export function defaultEnabled(
  type: NotificationType,
  channel: ChannelId,
): boolean {
  const def = definitionRegistry[type];
  if (!def) return false;
  if (!def.channels.includes(channel)) return false;
  return def.defaults[channel] ?? false;
}
