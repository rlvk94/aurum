import "server-only";

import type { NotificationType } from "../constants";
import { challengeOffTrackDefinition } from "./challenge-off-track";
import type { NotificationDefinition } from "./types";

export const definitionRegistry: Record<
  NotificationType,
  NotificationDefinition
> = {
  challenge_off_track: challengeOffTrackDefinition as NotificationDefinition,
};

export function getDefinition(type: NotificationType): NotificationDefinition {
  return definitionRegistry[type];
}
