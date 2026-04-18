"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";

import { Button } from "~/app/_components/button";
import { usePageMetadataValue } from "~/app/_components/page-metadata";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/app/_components/tooltip";
import { cn } from "~/app/_lib/utils";
import { findRoute } from "~/app/_lib/navigation";
import { api } from "~/trpc/react";

export function FavoriteStarButton() {
  const pathname = usePathname();
  const t = useTranslations();
  const metadata = usePageMetadataValue();
  const utils = api.useUtils();
  const favorites = api.favorite.list.useQuery();

  const route = findRoute(pathname);
  const registeredName = route ? t(route.titleKey) : null;
  // Page-provided title (for dynamic routes) wins over registry title.
  const name = metadata?.title ?? registeredName ?? null;
  const existing = favorites.data?.find((f) => f.path === pathname);
  const isFavorited = Boolean(existing);

  const toggle = api.favorite.toggle.useMutation({
    onMutate: async ({ name: newName, path }) => {
      await utils.favorite.list.cancel();
      const prev = utils.favorite.list.getData();
      const optimistic = existing
        ? (prev ?? []).filter((f) => f.path !== path)
        : [
            ...(prev ?? []),
            {
              id: `optimistic-${path}`,
              name: newName,
              path,
              sortOrder: 0,
            },
          ];
      utils.favorite.list.setData(undefined, optimistic);
      return { prev };
    },
    onError: (_err, _input, context) => {
      if (context?.prev) utils.favorite.list.setData(undefined, context.prev);
    },
    onSettled: () => {
      void utils.favorite.list.invalidate();
    },
  });

  const canFavorite = Boolean(name && pathname);
  const label = isFavorited
    ? t("favorites.removeLabel")
    : t("favorites.addLabel");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!canFavorite}
          onClick={() => {
            if (!canFavorite || !name) return;
            toggle.mutate({ name, path: pathname });
          }}
          aria-label={label}
          aria-pressed={isFavorited}
        >
          <Star
            className={cn(
              "transition-colors",
              isFavorited && "fill-primary text-primary",
            )}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
