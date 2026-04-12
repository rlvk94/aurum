# ADR-0011: Use next-intl for Internationalization

## Status

Proposed

## Date

2026-04-12

## Context

Aurum needs to support multiple languages. The primary audience is in Denmark, so Danish is the default locale, but English must also be supported. The localization solution must work with Next.js App Router, support both Server Components and Client Components, and handle number/date formatting.

We evaluated next-intl and next-translate. next-intl has stronger App Router support, built-in ICU message formatting, and a more active maintenance track for Next.js 16.

## Decision

Use [next-intl](https://next-intl.dev/) for internationalization, configured **without locale-based URL routing**. The locale is determined by user preference (cookie) or browser Accept-Language header, not by URL segments.

### Configuration

- **Supported locales:** `da` (Danish, default), `en` (English)
- **Locale resolution:** user's `locale` field (synced to cookie on sign-in) → `locale` cookie → Accept-Language header → default (`da`)
- **User locale field:** authenticated users store their locale preference in the database; this is synced to the `locale` cookie on sign-in and used for server-side contexts like email delivery
- **No `[locale]` URL segment** — locale is a user preference, not a URL concern
- **Plugin:** `next-intl/plugin` in `next.config.js` pointing to `src/i18n/request.ts`
- **Messages:** JSON files in `messages/da.json` and `messages/en.json`

### Usage

- **Server Components:** `useTranslations('namespace')` for sync access
- **Client Components:** `useTranslations('namespace')` hook (provided via `NextIntlClientProvider` in root layout)
- **Server-only contexts:** `getTranslations('namespace')` async function

### File structure

```
src/i18n/config.ts      — locale list and default
src/i18n/request.ts     — request-scoped locale resolution
messages/da.json        — Danish translations
messages/en.json        — English translations
```

## Consequences

- **Positive:** Clean integration with Next.js App Router — works in both Server and Client Components.
- **Positive:** No URL complexity — users don't see `/da/` or `/en/` prefixes.
- **Positive:** ICU message format support for plurals, interpolation, and rich text.
- **Positive:** Built-in number and date formatting respects the active locale.
- **Trade-off:** Locale switching requires a page reload (cookie change + refresh) since there's no URL-based routing.
- **Follow-up:** All user-facing strings must use translation keys, never hardcoded text. See ADR 0012.
