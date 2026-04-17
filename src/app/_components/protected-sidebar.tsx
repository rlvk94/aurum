"use client";

import { usePathname } from "next/navigation";

import { AppSidebar } from "~/app/_components/app-sidebar";
import { SettingsSidebar } from "~/app/_components/settings-sidebar";

export function ProtectedSidebar() {
  const pathname = usePathname();
  if (pathname.startsWith("/settings")) {
    return <SettingsSidebar />;
  }
  return <AppSidebar />;
}
