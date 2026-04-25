"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { format, parseISO } from "date-fns";
import { da, enUS } from "date-fns/locale";
import { ArrowRight } from "lucide-react";

import { Button } from "~/app/_components/button";
import { Badge } from "~/app/_components/badge";
import { cn } from "~/app/_lib/utils";

import type { Announcement } from "~/server/announcements";

export function AnnouncementCard({
  announcement,
  isNew,
  onCtaClick,
}: {
  announcement: Announcement;
  isNew: boolean;
  onCtaClick?: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = locale === "da" ? da : enUS;

  const title = t(announcement.titleKey);
  const body = t(announcement.bodyKey);
  const ctaLabel = announcement.ctaLabelKey
    ? t(announcement.ctaLabelKey)
    : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div
        data-project-palette={announcement.coverPalette}
        className={cn(
          "project-cover-shimmer relative h-32 px-6",
          "flex items-end pb-4",
        )}
      >
        <span
          aria-hidden
          className="project-cover-emoji absolute right-5 top-1/2 -translate-y-1/2 text-5xl leading-none"
        >
          {announcement.emoji}
        </span>
        {isNew && (
          <Badge className="absolute left-5 top-5 rounded-full border-0 bg-foreground px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-background">
            {t("whatsNew.newBadge")}
          </Badge>
        )}
      </div>

      <div className="space-y-3 p-6">
        <header className="space-y-1">
          <h3 className="font-display text-2xl text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {t("whatsNew.publishedOn", {
              date: format(parseISO(announcement.publishedAt), "PPP", {
                locale: dateLocale,
              }),
            })}
          </p>
        </header>

        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
          {body}
        </p>

        {ctaLabel && announcement.ctaHref && (
          <div className="pt-2">
            <Button asChild size="sm" onClick={onCtaClick}>
              <Link href={announcement.ctaHref}>
                {ctaLabel}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
