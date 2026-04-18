"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Star, X } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/app/_components/sidebar";
import { api } from "~/trpc/react";

export function FavoritesNavGroup() {
  const pathname = usePathname();
  const t = useTranslations();
  const utils = api.useUtils();
  const favorites = api.favorite.list.useQuery();
  const remove = api.favorite.remove.useMutation({
    onSuccess: () => {
      void utils.favorite.list.invalidate();
    },
  });

  if (!favorites.data || favorites.data.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("favorites.sectionTitle")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {favorites.data.map((fav) => (
            <SidebarMenuItem key={fav.id}>
              <SidebarMenuButton asChild isActive={pathname === fav.path}>
                <Link href={fav.path}>
                  <Star />
                  <span>{fav.name}</span>
                </Link>
              </SidebarMenuButton>
              <SidebarMenuAction
                onClick={() => remove.mutate({ id: fav.id })}
                aria-label={t("favorites.removeLabel")}
              >
                <X />
              </SidebarMenuAction>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
