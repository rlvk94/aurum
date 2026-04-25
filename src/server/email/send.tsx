import "server-only";

import { render } from "@react-email/render";
import { createTranslator } from "next-intl";

import { env } from "~/env";
import { type Locale } from "~/i18n/config";

import { getResendClient } from "./client";
import {
  getUserLocaleByEmail,
  getUserLocaleById,
  loadMessages,
} from "./locale";
import { InviteEmail } from "./templates/invite-email";
import { OtpEmail } from "./templates/otp-email";

const SIGN_IN_OTP_EXPIRY_MINUTES = 10;
const EMAIL_CHANGE_OTP_EXPIRY_MINUTES = 10;
const INVITE_EXPIRY_DAYS = 7;

type DispatchArgs = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

async function dispatch({ to, subject, html, replyTo }: DispatchArgs) {
  const resend = getResendClient();
  if (!resend) {
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
}

type Translator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

async function buildTranslators(locale: Locale) {
  const messages = await loadMessages(locale);
  const makeT = (namespace: string): Translator => {
    const t = createTranslator({
      locale,
      messages: messages as never,
      namespace: namespace as never,
    }) as unknown as Translator;
    return t;
  };
  return { common: makeT("emails.common"), makeT };
}

export async function sendSignInOtpEmail(args: {
  to: string;
  code: string;
}) {
  const locale = await getUserLocaleByEmail(args.to);
  const { common, makeT } = await buildTranslators(locale);
  const t = makeT("emails.signInOtp");

  const html = await render(
    <OtpEmail
      preview={t("preview", { code: args.code })}
      heading={t("heading")}
      intro={t("intro", { minutes: SIGN_IN_OTP_EXPIRY_MINUTES })}
      codeLabel={t("codeLabel")}
      code={args.code}
      footnote={common("ignoreIfNotYou")}
      footerText={common("footer")}
    />,
  );

  await dispatch({ to: args.to, subject: t("subject"), html });
}

export async function sendEmailChangeOtpEmail(args: {
  to: string;
  code: string;
  userId: string;
}) {
  const locale = await getUserLocaleById(args.userId);
  const { common, makeT } = await buildTranslators(locale);
  const t = makeT("emails.emailChangeOtp");

  const html = await render(
    <OtpEmail
      preview={t("preview", { code: args.code })}
      heading={t("heading")}
      intro={t("intro", { minutes: EMAIL_CHANGE_OTP_EXPIRY_MINUTES })}
      codeLabel={t("codeLabel")}
      code={args.code}
      footnote={t("didNotRequest")}
      footerText={common("footer")}
    />,
  );

  await dispatch({ to: args.to, subject: t("subject"), html });
}

export async function sendContactEmail(args: {
  name: string;
  email: string;
  message: string;
}) {
  const subject = `Aurum kontakt — ${args.name}`;

  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const messageHtml = escape(args.message).replace(/\n/g, "<br/>");

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 24px auto; padding: 0 16px;">
  <h2 style="font-family: Georgia, serif; font-weight: 400; font-size: 22px; margin: 0 0 16px;">Ny henvendelse fra landingssiden</h2>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <tr><td style="padding: 8px 0; color: #666; width: 80px;">Navn</td><td style="padding: 8px 0;"><strong>${escape(args.name)}</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #666;">E-mail</td><td style="padding: 8px 0;"><a href="mailto:${escape(args.email)}" style="color: #c69227;">${escape(args.email)}</a></td></tr>
  </table>
  <div style="border-top: 1px solid #e5e5e5; padding-top: 16px; line-height: 1.55;">${messageHtml}</div>
</body></html>`;

  if (!env.CONTACT_TO_EMAIL) {
    console.log(
      `[DEV-EMAIL] contact form: ${args.name} <${args.email}> — ${args.message} (CONTACT_TO_EMAIL not set, skipping send)`,
    );
    return;
  }

  await dispatch({
    to: env.CONTACT_TO_EMAIL,
    subject,
    html,
    replyTo: args.email,
  });
}

export async function sendFamilyInviteEmail(args: {
  to: string;
  familyName: string;
  inviterName: string;
  inviterId: string;
}) {
  const locale = await getUserLocaleById(args.inviterId);
  const { common, makeT } = await buildTranslators(locale);
  const t = makeT("emails.familyInvite");

  const acceptUrl = `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/login`;

  const html = await render(
    <InviteEmail
      preview={t("preview", { familyName: args.familyName })}
      heading={t("heading", { familyName: args.familyName })}
      intro={t("intro", {
        inviterName: args.inviterName,
        familyName: args.familyName,
      })}
      cta={t("cta")}
      linkFallback={t("linkFallback")}
      expiresIn={t("expiresIn", { days: INVITE_EXPIRY_DAYS })}
      acceptUrl={acceptUrl}
      footerText={common("footer")}
    />,
  );

  await dispatch({
    to: args.to,
    subject: t("subject", {
      inviterName: args.inviterName,
      familyName: args.familyName,
    }),
    html,
  });
}
