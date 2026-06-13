import "server-only";

import type { EmailMessage, EmailProvider } from "./provider";
import { resendEmailProvider } from "./resend-provider";

/**
 * Dev fallback when no provider is configured: logs instead of sending, mirroring
 * the existing `[DEV-EMAIL]` behavior. `isConfigured()` is true so the dispatcher
 * still renders + "delivers" (to the console) in local development.
 */
const consoleEmailProvider: EmailProvider = {
  name: "console",
  isConfigured() {
    return true;
  },
  async send({ to, subject, replyTo }: EmailMessage) {
    console.log(
      `[DEV-EMAIL] to=${to} subject=${subject}${replyTo ? ` replyTo=${replyTo}` : ""} (no email provider configured)`,
    );
  },
};

/**
 * Returns the active email provider. Resend when configured, otherwise the
 * console fallback so dev works without an API key.
 */
export function getEmailProvider(): EmailProvider {
  return resendEmailProvider.isConfigured()
    ? resendEmailProvider
    : consoleEmailProvider;
}
