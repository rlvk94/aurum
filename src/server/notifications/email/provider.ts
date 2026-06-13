import "server-only";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

/**
 * The swap seam for the email transport. Today the only implementation wraps
 * Resend; migrating to Postmark/SES later is one new file. See ADR-0025.
 */
export interface EmailProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(message: EmailMessage): Promise<void>;
}
