# ADR-0012: All User-Facing Text Must Use Translation Keys

## Status

Proposed

## Date

2026-04-12

## Context

Aurum supports multiple languages (Danish and English). To ensure the app is fully translatable and consistent, every piece of user-facing text must go through the translation system rather than being hardcoded in components.

Hardcoded strings create maintenance problems: they're invisible to translators, they fragment the language experience (some parts translated, some not), and they make it impossible to verify translation coverage.

## Decision

**Every user-facing string must use a translation key.** No hardcoded text in components, pages, or layouts.

### Rules

1. **All visible text** — labels, buttons, headings, descriptions, placeholders, error messages, empty states, tooltips — must come from a translation key via `useTranslations()` or `getTranslations()`.

2. **Message files are the source of truth** — `messages/da.json` and `messages/en.json` must contain every string shown to the user.

3. **Namespaced keys** — translations are organized by feature/page namespace (e.g. `common`, `dashboard`, `transactions`, `budgets`). Use the namespace that matches the feature area.

4. **Danish is the primary locale** — when adding new keys, always add the Danish translation first (`messages/da.json`), then the English translation (`messages/en.json`).

5. **No string concatenation for translated text** — use ICU message format for interpolation:
   ```json
   { "greeting": "Hej {name}" }
   ```
   Not: `t("hello") + " " + name`

6. **Formatting** — use next-intl's built-in formatters for numbers, dates, and currencies rather than manual formatting.

### Exceptions

- Technical identifiers not shown to users (CSS class names, data attributes, etc.)
- Log messages and console output (developer-facing, not user-facing)
- API error codes (the error *message* shown to users must still be translated)

## Consequences

- **Positive:** Complete translation coverage — switching locale translates the entire app.
- **Positive:** Single source of truth for all copy — easy to review, update, and hand off to translators.
- **Positive:** Catches missing translations early — next-intl warns about missing keys in development.
- **Trade-off:** Slightly more friction when adding new UI — every string requires a key in both message files.
- **Trade-off:** Message files grow with the app and need to stay organized by namespace.
- **Follow-up:** AI-assisted development must always add both `da` and `en` translations when creating new UI. CLAUDE.md is updated to reflect this.
