"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as React from "react";
import { Bell, ChevronUp, LogOut, Settings, Users } from "lucide-react";
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
import { WhatsNewSheet } from "~/app/_components/whats-new-sheet";

export function UserMenu() {
  const tCommon = useTranslations("common");
  const tWhatsNew = useTranslations("whatsNew");
  const router = useRouter();
  const { data: me } = api.user.me.useQuery();
  const { data: announcements } = api.announcement.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const unread = announcements?.unreadCount ?? 0;
  const unreadDisplay = unread > 9 ? "9+" : String(unread);

  const [whatsNewOpen, setWhatsNewOpen] = React.useState(false);
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
    <>
      <SidebarMenu>
        <SidebarMenuItem data-tour-id="settings">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="relative flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent">
                  <Users className="size-4" />
                  {unread > 0 && (
                    <span
                      className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground shadow-card whats-new-dot"
                      aria-hidden
                    >
                      {unreadDisplay}
                    </span>
                  )}
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
              <DropdownMenuItem onClick={() => setWhatsNewOpen(true)}>
                <Bell />
                <span className="flex-1">{tWhatsNew("title")}</span>
                {unread > 0 && (
                  <span
                    aria-label={tWhatsNew("openButtonLabel")}
                    className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
                  >
                    {unreadDisplay}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
      <WhatsNewSheet
        open={whatsNewOpen}
        onOpenChange={setWhatsNewOpen}
        side="left"
      />
    </>
  );
}
