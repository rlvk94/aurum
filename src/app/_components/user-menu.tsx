"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as React from "react";
import { ChevronUp, LogOut, Settings, Users } from "lucide-react";
import { authClient } from "~/app/_lib/auth-client";
import { api } from "~/trpc/react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/app/_components/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import { Kbd, KbdGroup } from "~/app/_components/kbd";

export function UserMenu() {
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { data: me } = api.user.me.useQuery();
  const [modKey, setModKey] = React.useState("Ctrl");

  React.useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      /mac|ipad|iphone/i.test(navigator.platform ?? navigator.userAgent)
    ) {
      setModKey("⌘");
    }
  }, []);

  return (
    <SidebarMenu>
      <SidebarMenuItem data-tour-id="settings">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent">
                <Users className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{me?.name}</span>
                <span className="truncate text-xs">{me?.email}</span>
              </div>
              <ChevronUp className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-popper-anchor-width)"
            side="top"
            align="start"
          >
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings />
                <span className="flex-1">{tCommon("settings")}</span>
                <KbdGroup>
                  <Kbd>{modKey}</Kbd>
                  <Kbd>,</Kbd>
                </KbdGroup>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await authClient.signOut();
                router.push("/login");
              }}
            >
              <LogOut />
              {tCommon("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
