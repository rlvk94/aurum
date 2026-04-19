import "server-only";

import { Resend } from "resend";

import { env } from "~/env";

let cached: Resend | null = null;

/**
 * Returns a Resend client when an API key is configured, otherwise `null`.
 * A null client signals the dispatcher to fall back to a console log — useful
 * for local development without needing an API key.
 */
export function getResendClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  cached ??= new Resend(env.RESEND_API_KEY);
  return cached;
}
