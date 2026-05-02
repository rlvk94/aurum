"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "~/app/_components/app-sidebar";
import { SettingsSidebar } from "~/app/_components/settings-sidebar";
import { useSidebar } from "~/app/_components/sidebar";

export function ProtectedSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  // Close the mobile sidebar after navigating — on desktop the sidebar stays
  // pinned, but on mobile it overlays content and should dismiss on selection.
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  if (pathname.startsWith("/settings")) {
    return <SettingsSidebar />;
  }
  return <AppSidebar />;
}
