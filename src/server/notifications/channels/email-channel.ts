import "server-only";

import { getEmailProvider } from "../email";
import type { Channel, DeliveryResult } from "./types";

export const emailChannel: Channel<"email"> = {
  id: "email",

  isConfigured() {
    // The console fallback is always "configured" in dev; in prod this reflects
    // whether Resend has a key.
    return getEmailProvider().isConfigured();
  },

  async deliver(target, message): Promise<DeliveryResult> {
    if (!target.email) return { ok: false, skipped: true };
    await getEmailProvider().send({
      to: target.email,
      subject: message.subject,
      html: message.html,
    });
    return { ok: true };
  },
};
