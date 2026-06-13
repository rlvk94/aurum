"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";

import { api } from "~/trpc/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/app/_components/sheet";

import { AnnouncementCard } from "./announcement-card";

export function WhatsNewSheet({
  open,
  onOpenChange,
  side = "left",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "left" | "right";
}) {
  const t = useTranslations("whatsNew");
  const utils = api.useUtils();

  const { data } = api.announcement.list.useQuery();
  const items = data?.items ?? [];
  const unreadIds = items.filter((i) => !i.seen).map((i) => i.id);

  const markSeen = api.announcement.markSeen.useMutation({
    onSuccess: () => {
      void utils.announcement.list.invalidate();
    },
  });

  // When the sheet opens with unseen entries, dismiss them all.
  useEffect(() => {
    if (open && unreadIds.length > 0) {
      markSeen.mutate({ ids: unreadIds });
      posthog.capture("whats_new_opened", {
        unread_count: unreadIds.length,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unreadIds.length]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className="w-full overflow-y-auto p-0 pb-[env(safe-area-inset-bottom,0px)] sm:max-w-md [&>button]:top-[calc(1rem+env(safe-area-inset-top,0px))]"
      >
        <SheetHeader className="border-border bg-background border-b px-6 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-5">
          <SheetTitle className="font-display text-2xl">
            {t("title")}
          </SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 py-5 sm:px-6">
          {items.length === 0 ? (
            <p className="border-border bg-card/50 text-muted-foreground rounded-lg border border-dashed px-6 py-12 text-center text-sm">
              {t("noUpdates")}
            </p>
          ) : (
            items.map((a) => (
              <AnnouncementCard
                key={a.id}
                announcement={a}
                isNew={!a.seen}
                onCtaClick={() => onOpenChange(false)}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
