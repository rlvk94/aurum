import "server-only";

import { env } from "~/env";
import { getResendClient } from "~/server/email/client";

import type { EmailMessage, EmailProvider } from "./provider";

/**
 * Resend-backed email provider. Mirrors the low-level dispatch in
 * `src/server/email/send.tsx` (throws on the provider error) so behavior is
 * identical to the existing transactional path.
 */
export const resendEmailProvider: EmailProvider = {
  name: "resend",

  isConfigured() {
    return getResendClient() !== null;
  },

  async send({ to, subject, html, replyTo }: EmailMessage) {
    const resend = getResendClient();
    if (!resend) {
      // Should not happen when isConfigured() gated the call, but keep the
      // null-safe dev fallback for direct callers.
      console.log(
        `[DEV-EMAIL] to=${to} subject=${subject}${replyTo ? ` replyTo=${replyTo}` : ""} (RESEND_API_KEY not set, skipping send)`,
      );
      return;
    }

    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      throw new Error(
        `Failed to send email "${subject}" to ${to}: ${error.message}`,
      );
    }
  },
};
