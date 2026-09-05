import "server-only";

import type { NotificationType } from "../constants";
import { challengeOffTrackDefinition } from "./challenge-off-track";
import { consumptionReadingReminderDefinition } from "./consumption-reading-reminder";
import type { NotificationDefinition } from "./types";

export const definitionRegistry: Record<
  NotificationType,
  NotificationDefinition
> = {
  challenge_off_track: challengeOffTrackDefinition as NotificationDefinition,
  consumption_reading_reminder:
    consumptionReadingReminderDefinition as NotificationDefinition,
};

export function getDefinition(type: NotificationType): NotificationDefinition {
  return definitionRegistry[type];
}
