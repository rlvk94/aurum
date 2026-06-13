import "server-only";

import { sendWebPush } from "../push/send";
import { isPushConfigured } from "../push/web-push";
import type { Channel, DeliveryResult } from "./types";

export const pushChannel: Channel<"push"> = {
  id: "push",

  isConfigured() {
    return isPushConfigured();
  },

  async deliver(target, message): Promise<DeliveryResult> {
    if (target.subscriptions.length === 0) {
      return { ok: false, skipped: true };
    }
    const { sent, pruned } = await sendWebPush(target.subscriptions, {
      title: message.title,
      body: message.body,
      url: message.url,
      tag: message.tag,
    });
    return { ok: sent > 0, pruned };
  },
};
