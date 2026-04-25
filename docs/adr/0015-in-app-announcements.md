# ADR-0015: In-App Announcements as Bundled Content

## Status

Accepted

## Date

2026-04-25

## Context

Aurum is a small product with a single development team and an infrequent release cadence. As features ship, we want users to discover them — a quiet surface in the sidebar that highlights what's new since their last visit. Without it, useful additions go unnoticed and the app feels static.

Two storage strategies were considered:

1. **A database table with an admin UI.** Each announcement would be a row, edited via a settings screen. Most flexible (announcements can be pushed without a deploy, scheduled, A/B tested) but expensive to build for an MVP audience: it requires an admin role concept Aurum does not have today, plus authoring/publishing workflows, scheduling logic, and audience targeting — all of which expand the surface area materially.

2. **Content bundled in code.** Announcements live as a TypeScript array shipped with the app; new entries land via the same PR that ships the feature they describe. No admin UI, no scheduling logic, no separate publishing system. Announcement copy goes through the same review path as the rest of the codebase. The downside is that we cannot publish announcements out-of-band — a content fix needs a deploy. For our cadence and team size, that is fine.

Per-user dismissal also has two reasonable shapes:

- **A single monotonic pointer** on `user`: `lastSeenAnnouncementId`. Cheaper to read (no join), but loses precision — if a user opens the surface it has to mark everything as seen at once.
- **A join table** of `(user_id, announcement_id, dismissed_at)`. Records exactly which user has seen which announcement, with timestamps. Enables precise analytics (which announcements actually got read, time-to-read after publish) and per-announcement UX (e.g. let users hide one entry while keeping another visible). One extra row per (user, announcement) pair.

We pick the join table. The extra storage is negligible (one row per dismissal), and being able to ask "did this user see announcement X" precisely is worth more than the slightly cheaper read of a single column.

## Decision

### Content storage

A bundled TypeScript module (`src/server/announcements/index.ts`) exports a `const ANNOUNCEMENTS: ReadonlyArray<Announcement>` array. Each entry has:

```ts
type Announcement = {
  id: string;              // slug, e.g. "2026-04-projects"
  titleKey: string;        // "whatsNew.entries.<slug>.title"
  bodyKey: string;         // "whatsNew.entries.<slug>.body"
  ctaLabelKey?: string;    // "whatsNew.entries.<slug>.cta"
  ctaHref?: string;        // internal path the CTA navigates to
  emoji: string;
  coverPalette: ProjectPalette; // reuses the eight Projects palettes
  publishedAt: string;     // ISO date "YYYY-MM-DD"
};
```

The same module exposes two pure helpers:

- `getVisibleAnnouncements(now?: Date)` — filters `publishedAt <= today` and returns entries sorted newest-first by lexicographic id.
- `latestAnnouncementId(now?: Date)` — convenience that returns the top id (or `null` when nothing is published).

Slug ids are prefixed `YYYY-MM-` so lexicographic order matches release order. The `publishedAt` filter lets a future-dated entry sit in `main` until its release without being visible.

To announce a new feature, append a new entry and add the corresponding translation keys under `whatsNew.entries.<slug>` in both `messages/da.json` and `messages/en.json`. Visual treatment (cover band + emoji) reuses the Projects design system: the same eight palettes, the same `<ProjectCover>` shimmer, the same DM Serif Display title type.

### Per-user dismissal

A new table `announcement_dismissal` (`src/server/db/schema/announcement.ts`) with composite PK:

```
announcement_dismissal {
  user_id          text NOT NULL → user.id (ON DELETE CASCADE)
  announcement_id  text NOT NULL
  dismissed_at     timestamptz NOT NULL
  PRIMARY KEY (user_id, announcement_id)
}
```

Cascade-on-user-delete handles cleanup automatically. There is no cleanup of dismissals for retired announcements — a retired slug just stops appearing in `getVisibleAnnouncements()`, and stale rows are harmless.

### tRPC procedures (`src/server/api/routers/announcement.ts`)

Two `protectedProcedure` endpoints:

- `list` (query) — calls `getVisibleAnnouncements()` and joins `announcement_dismissal` for the current user. Returns `{ items, unreadCount }`, where each `item` is a clone of the bundled entry decorated with `seen: boolean` and `seenAt: Date | null`. `unreadCount = items.filter(i => !i.seen).length`.
- `markSeen({ ids: string[] })` (mutation) — accepts 1..50 slugs, filters to slugs that exist in the bundle, then `INSERT ... ON CONFLICT DO NOTHING` for `(userId, announcementId)`. Returns `{ inserted }`. Idempotent and safe to call repeatedly.

Both registered in `root.ts` as `announcement: announcementRouter`. The protected layout pre-fetches `announcement.list` so the sidebar avatar badge has fresh data on first render.

### UI

The bell sits inside the **UserMenu** (sidebar footer), not the top nav — kept close to other user-scoped controls (settings, sign out). It is implemented in three pieces:

- **`UserMenu`** (`src/app/_components/user-menu.tsx`) — reads `unreadCount` via `api.announcement.list.useQuery()`. When the menu is closed, a small numeric pill (`1`/`2`/`9+`) renders on the avatar tile in the top-right with the same pulse animation used elsewhere. When the menu is open, the first dropdown item is "What's new" with a `Bell` icon and the same numeric badge on the right.
- **`WhatsNewSheet`** (`src/app/_components/whats-new-sheet.tsx`) — wraps the `Sheet` primitive (deliberately *not* the `Drawer` primitive). Defaults to opening from the left so it animates out from the sidebar that triggered it. The component is named "Sheet" to match the underlying primitive and avoid confusion with the existing `Drawer` component used elsewhere.
- **`AnnouncementCard`** (`src/app/_components/announcement-card.tsx`) — cover band (palette + emoji) above a card body with a "New" badge for unseen entries, the title in DM Serif Display, the publish date, the markdown-style body, and an optional CTA button.

When the sheet opens with unseen entries, a single `useEffect` fires `markSeen({ ids: unreadIds })` and emits a `whats_new_opened` PostHog event with `unread_count`. Closing-then-reopening on the same data will not re-fire because no entries are unread anymore.

There is **no auto-open**. The badge alone surfaces unread updates; users open the sheet on their own terms. Earlier iterations auto-opened the sheet on first sign-in after release; that proved aggressive and was removed.

### First entry

The bundle ships with one entry, `id: "2026-04-projects"`:

```ts
{
  id: "2026-04-projects",
  titleKey: "whatsNew.entries.projects.title",
  bodyKey: "whatsNew.entries.projects.body",
  ctaLabelKey: "whatsNew.entries.projects.cta",
  ctaHref: "/projects",
  emoji: "🗂️",
  coverPalette: "gold",
  publishedAt: "2026-04-25",
}
```

It announces the Projects feature (ADR 0014) and links to `/projects`.

### Tests

`src/server/announcements/index.test.ts` covers the helper invariants:

- The Projects launch entry exists and has the expected id.
- `getVisibleAnnouncements` filters out future-dated entries.
- Returned order is newest-first by lexicographic id.
- `latestAnnouncementId` returns the highest id, or `null` when nothing is published yet.

Router-level integration is exercised manually; the helpers and the per-user join table together keep the surface narrow enough that pure unit tests catch the bulk of regressions.

## Consequences

- **Positive:** Zero infrastructure to maintain. A feature PR ships its own announcement copy.
- **Positive:** Translation parity is enforced by `next-intl` — missing keys fail loudly at runtime.
- **Positive:** Per-user-per-announcement state means analytics (read rates, time-to-read after publish) and per-entry UX (e.g. dismissing one without dismissing another) are straightforward to add later.
- **Positive:** Reusing the Projects palettes / cover treatment keeps the design language unified at no extra design cost.
- **Positive:** Living inside the user menu (not the top nav) puts the bell next to the user's own context and keeps the top bar focused on navigation.
- **Trade-off:** Announcements cannot be published, edited, or unpublished without a deploy. For our cadence this is a feature, not a bug — every announcement goes through code review and ships with the work it describes. If we ever need ad-hoc messaging, this ADR can be superseded.
- **Trade-off:** One row per (user, dismissed announcement). Negligible at the cadence we expect, but worth keeping an eye on if the announcement count grows large.
- **Trade-off:** Slug ordering is by ASCII lex compare. `YYYY-MM-` prefix is the convention; entries that don't follow it would sort unexpectedly.
- **Out of scope (left for a future ADR if needed):** scheduling beyond `publishedAt`, audience targeting (per-family, per-role), A/B variants, rich-media bodies, and deep-linking to a specific announcement.
