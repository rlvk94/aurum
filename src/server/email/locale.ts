import "server-only";

import { eq } from "drizzle-orm";

import { defaultLocale, type Locale, locales } from "~/i18n/config";
import { db } from "~/server/db";
import { user } from "~/server/db/schema";

type Messages = Record<string, unknown>;

function coerceLocale(value: string | null | undefined): Locale {
  if (value && (locales as readonly string[]).includes(value)) {
    return value as Locale;
  }
  return defaultLocale;
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  const mod = (await import(`../../../messages/${locale}.json`)) as {
    default: Messages;
  };
  return mod.default;
}

export async function getUserLocaleByEmail(email: string): Promise<Locale> {
  const [row] = await db
    .select({ locale: user.locale })
    .from(user)
    .where(eq(user.email, email.toLowerCase()));
  return coerceLocale(row?.locale);
}

export async function getUserLocaleById(id: string): Promise<Locale> {
  const [row] = await db
    .select({ locale: user.locale })
    .from(user)
    .where(eq(user.id, id));
  return coerceLocale(row?.locale);
}
