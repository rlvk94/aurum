import "server-only";

import { render } from "@react-email/render";

import { env } from "~/env";
import { ChallengeOffTrackEmail } from "~/server/email/templates/challenge-off-track-email";
import { buildTranslators } from "~/server/email/translators";

import type { RenderedMessage } from "../channels/types";
import type { ChannelId } from "../constants";
import type { NotificationDefinition, RenderContext } from "./types";

export type ChallengeOffTrackPayload = {
  challengeId: string;
  challengeName: string;
  instanceId: string;
};

function challengeUrl(challengeId: string): string {
  return `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/budgets/challenges/${challengeId}`;
}

export const challengeOffTrackDefinition: NotificationDefinition<ChallengeOffTrackPayload> =
  {
    type: "challenge_off_track",
    channels: ["email", "push"],
    defaults: { email: true, push: true },

    async render(
      channel: ChannelId,
      { payload, locale }: RenderContext<ChallengeOffTrackPayload>,
    ): Promise<RenderedMessage | null> {
      const { common, makeT } = await buildTranslators(locale);
      const url = challengeUrl(payload.challengeId);

      if (channel === "email") {
        const t = makeT("emails.challengeOffTrack");
        const html = await render(
          <ChallengeOffTrackEmail
            preview={t("preview", { challengeName: payload.challengeName })}
            heading={t("heading")}
            intro={t("intro", { challengeName: payload.challengeName })}
            body={t("body")}
            cta={t("cta")}
            ctaUrl={url}
            footerText={common("footer")}
          />,
        );
        return {
          channel: "email",
          subject: t("subject", { challengeName: payload.challengeName }),
          html,
        };
      }

      if (channel === "push") {
        const t = makeT("notifications.push.challengeOffTrack");
        return {
          channel: "push",
          title: t("title", { challengeName: payload.challengeName }),
          body: t("body"),
          url,
          tag: `challenge-${payload.instanceId}`,
        };
      }

      return null;
    },
  };
