import "server-only";

export { dispatchNotification, type DispatchSummary } from "./dispatch";
export {
  CHANNELS,
  NOTIFICATION_TYPES,
  type ChannelId,
  type NotificationType,
  isChannelId,
  isNotificationType,
} from "./constants";
export { definitionRegistry, getDefinition } from "./definitions/registry";
export type {
  NotificationDefinition,
  NotificationRecipient,
} from "./definitions/types";
export { defaultEnabled } from "./preferences/defaults";
export {
  resolveSubscriptions,
  resolveSubscriptionsFromRows,
} from "./preferences/resolve";
export { resolveFamilyMembers } from "./recipients/family";
export { loadNotifiedUserIds, recordNotified, clearEpisode } from "./dedupe";
export type { ChallengeOffTrackPayload } from "./definitions/challenge-off-track";
