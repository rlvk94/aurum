export const locales = ["da", "en"] as const;
export const defaultLocale = "da" as const;

export type Locale = (typeof locales)[number];
