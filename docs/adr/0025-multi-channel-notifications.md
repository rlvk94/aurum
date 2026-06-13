# ADR-0025: Multi-Channel Notification System

## Status

Proposed

## Date

2026-06-13

## Context

Until now the app's only outbound messaging is a handful of hardcoded
transactional emails in `src/server/email/send.tsx` (OTP, family invite, contact
form, signup notification, billing dunning). There is no concept of a
user-controllable notification, no second delivery channel, and no way for a
feature to say "tell the relevant family members that X happened."

The first concrete need is a **challenge off-track** alert: when a family
spending/savings challenge is trending to miss its target for the current
period, notify the family. But building that as a one-off would repeat the
hardcoded-email mistake. We want a system where:

- A **user** individually subscribes to notification **types** on a per-**channel**
  basis (email and web push now; SMS / Slack / webhook later).
- Adding a new channel or a new notification type is cheap and local.
- The underlying email provider (currently Resend) is swappable behind a seam.
- Transactional/security messages (OTP, invite) can **never** be turned off.

Delivery decisions already made with the product owner:

- **Web push is self-hosted via VAPID** (the `web-push` package), not a
  third-party push service — consistent with the EU-only/GDPR posture (PostHog
  EU, no extra data processors).
- Off-track detection runs on a **daily cron**, mirroring the existing
  `billing-sweep` cron pattern.

## Decision

### One generic dispatch core, many thin channel adapters

A new server-only module `src/server/notifications/` owns the abstraction:

- **`Channel`** interface — `id`, `isConfigured()`, `deliver(target, message)`.
  Implementations: `email-channel` (delegates to an `EmailProvider`) and
  `push-channel` (delegates to `web-push`). Registered in a `channelRegistry`.
- **`NotificationDefinition`** — one per notification *type*. Declares the
  channels it may use, its **default opt-in per channel**, and a
  `render(channel, ctx)` that returns a channel-specific, localized payload (or
  `null` to skip). Registered in a `definitionRegistry`.
- **`dispatchNotification({ type, recipients, payload, dedupeKey? })`** — the
  single orchestrator. For each recipient × each allowed channel: check the
  user's resolved subscription, check the channel is configured, render, and
  deliver. One channel/recipient failure never aborts the rest (same ethos as
  `billing-sweep`'s per-row `.catch()`). When a `dedupeKey` is supplied and at
  least one channel delivered, a `notification_log` row is written.

Adding a channel = one file + a registry entry. Adding a type = one
`NotificationDefinition` file + a registry entry. The orchestrator never
changes.

### `text` columns, not `pgEnum`, for `type` and `channel`

The set of notification types and channels grows frequently. Modeling them as
Postgres enums would force a migration on every addition. Instead the DB stores
`text`, and the valid values are owned by code-level `const` arrays
(`CHANNELS`, `NOTIFICATION_TYPES`) validated at the tRPC boundary with Zod. (By
contrast `challenge_type` is a genuinely closed domain and correctly stays a
`pgEnum`.)

### Sparse, default-on-in-code preferences

`notification_preference` is `(userId, type, channel, enabled)` with PK
`(userId, type, channel)`. A row exists **only** when a user deviates from the
type's declared default. Resolution is
`enabled = storedRow?.enabled ?? definition.defaults[channel]`. This needs no
backfill for existing users and no migration when a new type ships with its own
defaults. Channels not listed in a definition's `channels` are always off.

### Transactional bypass is structural, not a flag

OTP, invite, contact, and signup emails keep calling `send.tsx` directly and
have **no** `NotificationType`. There is therefore no surface through which a
user could opt out of a security/transactional message — the bypass is enforced
by construction. Billing dunning emails also stay transactional **for now** (see
Consequences) rather than becoming an opt-out-able type.

### Web push specifics

- VAPID keys via env: `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (server),
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client, used as `applicationServerKey`).
  Required in production, optional in dev; when absent `push-channel.isConfigured()`
  is false and push is silently skipped (mirrors the Resend-null `[DEV-EMAIL]`
  dev fallback).
- A static service worker at `public/sw.js` handles `push` (showNotification) and
  `notificationclick` (focus/open the deep link).
- Subscriptions live in `push_subscription` (one user → many devices), keyed by a
  unique `endpoint`. On a `410 Gone` / `404` from the push service, the dead
  subscription row is pruned.

### Challenge off-track as the first event

The on/off-track math (`computeOnTrack`) currently lives in a client `_lib` file
but is pure. It is extracted to a shared, `server-only`-free module
`src/lib/challenge-on-track.ts` and re-exported from the existing client file so
nothing breaks. A daily cron route `/api/cron/notification-sweep` (auth via
`CRON_SECRET`, same shape as `billing-sweep`) rotates each non-archived
challenge, computes progress with the existing
`challenge-service.computeProgress`, evaluates on/off-track, and dispatches the
`challenge_off_track` notification to all members of the challenge's family.

Dedupe key is `challenge_off_track:{instanceId}`, scoped per user and per
off-track *episode*: notify once when an instance goes off-track; on recovery
(back on-track) the log row is deleted to **re-arm**, so a later re-flip notifies
again; never re-notify daily while it stays off-track. Because repeating
challenges spawn a fresh `challengeInstance` per period, per-instance keying
auto-scopes to per-period.

## Consequences

- **Positive:** New channels (SMS, Slack, webhook) and new notification types are
  additive — a file and a registry entry, no orchestrator or schema churn.
- **Positive:** Email provider is swappable behind `EmailProvider`; migrating off
  Resend later is one new file.
- **Positive:** Security/transactional messages are un-opt-out-able by
  construction.
- **Positive:** Existing emails are untouched in this change (only the pure
  `buildTranslators` helper is extracted and re-imported), so blast radius is
  small.
- **Trade-off:** `text` columns mean validity is enforced in app code, not by the
  database. Accepted deliberately to avoid per-type/-channel migrations.
- **Trade-off:** Web push on iOS Safari only works when the PWA is installed to
  the home screen (16.4+). Push is treated as best-effort; email remains the
  reliable baseline. The UI surfaces an install hint.
- **Operational:** A daily Coolify cron must be added to POST
  `/api/cron/notification-sweep` with `Authorization: Bearer ${CRON_SECRET}`
  (e.g. `0 6 * * *` Europe/Copenhagen). This is a production-pipeline change made
  by a human, not by tooling.
- **Deferred:** Billing dunning emails are **not** migrated into the preference
  system now — letting owners opt out of dunning is a business decision and would
  widen this change's blast radius. They remain a future candidate type only if
  product decides those alerts are optional.
- **Deferred:** Cleanup of stale `notification_log` rows for long-completed
  instances (harmless because per-instance keys never collide with new
  instances).

## Terms & Conditions

Reviewed per the T&C-on-feature-change rule. Web push introduces a new category
of stored personal data — push **subscriptions** (endpoint + keys) and a
device/user-agent label per device — and a new outbound contact channel. This is
first-party storage with no new third-party processor (push is self-hosted via
VAPID; delivery transits the user's own browser-vendor push service, inherent to
the Web Push standard). A short addition to the privacy/terms covering (a) that
the app stores push subscriptions for devices the user opts in, (b) that they can
disable them per device and per notification type, and (c) the browser-vendor
push transit should be added before this ships to production. **T&C update
recommended (privacy section); flagged to the owner.**
