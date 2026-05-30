# ADR-0023: Terms & Conditions Acceptance with Versioned Snapshots

## Status

Accepted

## Date

2026-05-30

## Context

The app had no Terms & Conditions and no record of user consent. We need three
things:

1. **Real, viewable terms** for the product.
2. **Mandatory acceptance at signup** — no user reaches the app without accepting.
3. **A durable, documentation-grade record** of the *exact* terms text each user
   accepted and *when*, that survives later edits to the published terms.

Email OTP merges sign-in and sign-up, so there is no distinct "create account"
form to attach a checkbox to; the natural one-time gate for new users is the
`/welcome` onboarding flow (`onboardedAt` is null until they finish).

We already have a "bundled content" pattern for in-app announcements (ADR-0015):
content lives in code, referenced by an `id`, with the user-facing text in the
mutable next-intl message files and a per-user state row recording dismissal.
That pattern is unsuitable for legal consent: if the message text changes after
a user "accepted", the recorded `id` no longer tells us what they actually
agreed to. Legal documentation requires the **verbatim text**, pinned.

The agreed scope is **signup-only enforcement now**, but the design must support
later pushing an updated terms version to all existing users and re-collecting
consent.

## Decision

**Version-pinned terms content + an append-only acceptance log that snapshots the
exact accepted text.**

- **Content bundle** (`src/server/terms/`): terms are authored as
  version-pinned documents (`TermsVersion` = `version`, `effectiveDate`,
  `content` per locale as markdown), shipped with the code. A shipped version's
  text is **immutable**; to change the terms you **append a new version**. This
  is the key divergence from the announcements pattern — the full text is stored
  in the bundle (not the mutable message files) so an accepted snapshot can be
  reproduced and verified. The v1 terms include an explicit
  "we may change these terms at any time" clause.
- **Acceptance log** (`terms_acceptance` table): append-only, one row per
  `(user, version)` (unique index → idempotent accept). Each row stores the
  **verbatim `content` snapshot**, a **SHA-256 `content_hash`**, the `version`,
  the `locale` the user read it in, and `accepted_at`.
- **Server-derived snapshot**: the `terms.accept` tRPC mutation re-derives the
  text from the bundle by `(version, locale)` and hashes it server-side — it
  never trusts client-supplied text — so the stored copy is authoritative and
  tamper-proof.
- **Signup gate**: a required Terms step in `/welcome` (after the language step,
  so the doc renders in the chosen locale). Enforcement is **flow-only** — the
  step blocks Continue until the box is ticked; we deliberately did not add a
  server check in `completeOnboarding`, matching how the other onboarding steps
  work.
- **Public page**: a server-rendered `/terms` page (allow-listed in `proxy.ts`)
  for viewing the current terms without a session; linked from login and the
  landing footer. Rendered with `react-markdown` (the raw markdown is what gets
  snapshotted, so rendering is purely presentational).
- **Existing users**: a one-time data migration resets onboarding
  (`onboarded_at = NULL`, `onboarding_step = 0`) so the whole user base is
  prompted to accept on next visit. The existing name is prefilled on re-onboard
  to avoid data loss.
- **Governance**: `AGENTS.md` carries a standing rule to re-check whether the
  terms need a new version whenever a feature is added, changed, or removed.

## Consequences

- **Positive:** We hold a legally meaningful, verbatim record of exactly what
  each user accepted and when, immune to later edits of the published terms.
- **Positive:** Tamper-proof — the snapshot is server-derived, and the hash lets
  us prove integrity of any stored copy.
- **Positive:** Future-proof for re-consent. The append-only `(user, version)`
  log already supports multiple versions per user; collecting renewed consent
  later is "ship a new `TermsVersion` + re-gate" (a dedicated re-consent check in
  the protected layout, or another onboarding reset) — no schema change.
- **Trade-off:** Terms text is bundled in code, so changing it requires a
  release rather than a CMS edit. Acceptable: legal text changes rarely and
  benefits from PR review.
- **Trade-off:** The full text is duplicated into every acceptance row. This is
  intentional (audit fidelity over storage) and cheap at this scale.
- **Trade-off:** Flow-only enforcement means a crafted client could skip the
  step; the residual risk is low (the user only gains access they signed up for)
  and a server check can be added later if needed.
- **Trade-off:** Resetting onboarding sends existing users back through the
  flow (language → terms → name → theme), adding some friction; the name
  prefill mitigates the worst of it.
- **Caveat:** The v1 terms are a **starter draft and must be reviewed by legal
  counsel** before being relied upon.

## Related

- ADR-0015 (in-app announcements) — the bundled-content pattern this builds on
  and intentionally diverges from for audit fidelity.
- ADR-0011 / ADR-0012 (next-intl, translation keys) — UI chrome uses a `terms`
  i18n namespace; the legal body text lives in the content bundle, not messages.
