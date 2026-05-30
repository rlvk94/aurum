# AGENTS.md

Guidance for AI coding agents working in this repo. `CLAUDE.md` holds the full
project context (architecture, domain model, conventions, ADR index) and is the
source of truth — it applies here too. This file collects cross-cutting rules
that must be checked on every change.

## Terms & Conditions must track feature changes

**Whenever you add, change, or remove a feature, validate whether the Terms &
Conditions need to change as a result — before considering the work done.**

- T&C content lives in `src/server/terms/` as version-pinned documents (DA + EN).
- If the change affects anything the terms cover — what the app does with user
  data, what users are responsible for, billing, privacy, acceptable use, etc. —
  **append a new `TermsVersion`**. Never edit a shipped version's text in place:
  each user's accepted copy is snapshotted verbatim and must stay accurate.
- Acceptances are recorded per `(user, version)` in the append-only
  `terms_acceptance` table. To collect renewed consent after a terms change,
  ship the new version and re-gate users (reset onboarding, or add a dedicated
  re-consent gate in the protected layout — the schema already supports this).
- If the terms do **not** need to change, note that you checked.
