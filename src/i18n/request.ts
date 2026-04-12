import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { type Locale, locales, defaultLocale } from "./config";

/**
 * Resolves the active locale for the current request.
 *
 * Resolution order:
 * 1. Authenticated user's `locale` field (set by the app after sign-in)
 * 2. `locale` cookie (for public/unauthenticated screens)
 * 3. Accept-Language header
 * 4. Default locale (da)
 *
 * The user's locale preference is synced to the cookie on sign-in,
 * so the cookie acts as a cache for both authenticated and public screens.
 * For emails and other server-side contexts, use the user's stored locale directly.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  // 1. Check cookie (reflects user preference when signed in, or browser choice when not)
  const cookieLocale = cookieStore.get("locale")?.value as Locale | undefined;
  if (cookieLocale && locales.includes(cookieLocale)) {
    return {
      locale: cookieLocale,
      messages: (await import(`../../messages/${cookieLocale}.json`)).default,
    };
  }

  // 2. Check Accept-Language header
  const acceptLanguage = headerStore.get("accept-language") ?? "";
  const preferred = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0]?.trim().split("-")[0])
    .find((lang): lang is Locale => locales.includes(lang as Locale));

  const locale = preferred ?? defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
