import "server-only";

import { render } from "@react-email/render";

import { env } from "~/env";
import { ConsumptionReminderEmail } from "~/server/email/templates/consumption-reminder-email";
import { buildTranslators } from "~/server/email/translators";

import type { RenderedMessage } from "../channels/types";
import type { ChannelId } from "../constants";
import type { NotificationDefinition, RenderContext } from "./types";

export type ConsumptionReadingReminderPayload = {
  familyId: string;
  /** ISO date the reminder is for (Europe/Copenhagen). */
  dueDate: string;
  /** Active meters that still lack a reading on `dueDate`. */
  meterNames: string[];
};

function consumptionUrl(): string {
  return `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/consumption`;
}

function joinNames(names: string[], locale: string): string {
  try {
    return new Intl.ListFormat(locale, {
      style: "long",
      type: "conjunction",
    }).format(names);
  } catch {
    return names.join(", ");
  }
}

export const consumptionReadingReminderDefinition: NotificationDefinition<ConsumptionReadingReminderPayload> =
  {
    type: "consumption_reading_reminder",
    channels: ["email", "push"],
    defaults: { email: true, push: true },

    async render(
      channel: ChannelId,
      { payload, locale }: RenderContext<ConsumptionReadingReminderPayload>,
    ): Promise<RenderedMessage | null> {
      const { common, makeT } = await buildTranslators(locale);
      const url = consumptionUrl();
      const count = payload.meterNames.length;

      if (channel === "email") {
        const t = makeT("emails.consumptionReadingReminder");
        const html = await render(
          <ConsumptionReminderEmail
            preview={t("preview", { count })}
            heading={t("heading")}
            intro={t("intro", { count })}
            meterNames={payload.meterNames}
            body={t("body")}
            cta={t("cta")}
            ctaUrl={url}
            footerText={common("footer")}
          />,
        );
        return {
          channel: "email",
          subject: t("subject"),
          html,
        };
      }

      if (channel === "push") {
        const t = makeT("notifications.push.consumptionReadingReminder");
        return {
          channel: "push",
          title: t("title"),
          body: t("body", {
            meterNames: joinNames(payload.meterNames, locale),
          }),
          url,
          tag: `consumption-reminder-${payload.familyId}`,
        };
      }

      return null;
    },
  };
