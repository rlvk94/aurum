// Bundled "What's New" content. Authored by developers per release; shipped
// with the codebase. See ADR 0015. To announce a new feature, append a new
// entry below with a unique `id` (slug, "YYYY-MM-feature"). The id is
// compared lexicographically — newer slugs must sort higher.
//
// All user-facing strings reference next-intl keys under the `whatsNew`
// namespace so DA and EN content is co-located with the rest of i18n.

import type { ProjectPalette } from "~/server/api/routers/project";

export type Announcement = {
  /** Slug, e.g. "2026-04-projects". Lexicographic ordering. */
  id: string;
  titleKey: string;
  bodyKey: string;
  ctaLabelKey?: string;
  ctaHref?: string;
  emoji: string;
  coverPalette: ProjectPalette;
  /** ISO date when the announcement should start being visible. */
  publishedAt: string;
};

// Ordered oldest → newest.
export const ANNOUNCEMENTS: ReadonlyArray<Announcement> = [
  {
    id: "2026-04-projects",
    titleKey: "whatsNew.entries.projects.title",
    bodyKey: "whatsNew.entries.projects.body",
    ctaLabelKey: "whatsNew.entries.projects.cta",
    ctaHref: "/projects",
    emoji: "🗂️",
    coverPalette: "gold",
    publishedAt: "2026-04-25",
  },
  {
    id: "2026-05-savings",
    titleKey: "whatsNew.entries.2026-05-savings.title",
    bodyKey: "whatsNew.entries.2026-05-savings.body",
    ctaLabelKey: "whatsNew.entries.2026-05-savings.cta",
    ctaHref: "/accounts",
    emoji: "🪙",
    coverPalette: "sage",
    publishedAt: "2026-05-23",
  },
  {
    id: "2026-09-consumption",
    titleKey: "whatsNew.entries.2026-09-consumption.title",
    bodyKey: "whatsNew.entries.2026-09-consumption.body",
    ctaLabelKey: "whatsNew.entries.2026-09-consumption.cta",
    ctaHref: "/consumption",
    emoji: "⚡",
    coverPalette: "sky",
    publishedAt: "2026-09-05",
  },
];

export function getVisibleAnnouncements(
  now: Date = new Date(),
): Announcement[] {
  const today = now.toISOString().slice(0, 10);
  return ANNOUNCEMENTS.filter((a) => a.publishedAt <= today)
    .slice()
    .sort((a, b) => (a.id < b.id ? 1 : -1));
}

export function latestAnnouncementId(now: Date = new Date()): string | null {
  const visible = getVisibleAnnouncements(now);
  return visible[0]?.id ?? null;
}
