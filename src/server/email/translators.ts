import "server-only";

import { createTranslator } from "next-intl";

import { type Locale } from "~/i18n/config";

import { loadMessages } from "./locale";

export type Translator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

/**
 * Builds next-intl translators for a given locale for use in server-side
 * contexts that have no request scope (emails, push payloads, cron jobs).
 * Returns a ready-made `emails.common` translator plus a `makeT(namespace)`
 * factory for any other namespace.
 */
export async function buildTranslators(locale: Locale) {
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
