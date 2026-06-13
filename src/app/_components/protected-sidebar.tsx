"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { AppSidebarContent } from "~/app/_components/app-sidebar";
import { SettingsSidebarContent } from "~/app/_components/settings-sidebar";
import { Sidebar, useSidebar } from "~/app/_components/sidebar";

export function ProtectedSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const isSettings = pathname.startsWith("/settings");
  const prevPathnameRef = useRef(pathname);

  // On mobile the sidebar overlays content, so it dismisses after the user
  // picks a destination. Exception: keep the sheet open when *entering* the
  // settings section so the user can pick a settings sub-page without
  // reopening it. We detect the transition (prev path wasn't settings) rather
  // than matching "/settings" directly, because next.config redirects
  // /settings → /settings/profile, so usePathname never reports "/settings".
  // Moving between settings sub-pages closes like any normal navigation.
  useEffect(() => {
    const prev = prevPathnameRef.current;
    if (prev === pathname) return;
    prevPathnameRef.current = pathname;

    if (!isMobile) return;

    const enteringSettings = isSettings && !prev.startsWith("/settings");
    if (enteringSettings) return;

    setOpenMobile(false);
  }, [pathname, isSettings, isMobile, setOpenMobile]);

  // A single Sidebar wrapper hosts both variants so the mobile Sheet (a Radix
  // Dialog) stays mounted across the app↔settings swap — only its children
  // change. Previously each variant rendered its own Sheet, so swapping while
  // the Sheet was open unmounted the Dialog before its body-style cleanup ran,
  // leaving `pointer-events: none` stuck on the body and the page unresponsive.
  return (
    <Sidebar
      variant="inset"
      data-tour-id={isSettings ? undefined : "navigation"}
    >
      {isSettings ? <SettingsSidebarContent /> : <AppSidebarContent />}
    </Sidebar>
  );
}
