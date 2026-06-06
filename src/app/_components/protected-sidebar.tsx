"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "~/app/_components/app-sidebar";
import { SettingsSidebar } from "~/app/_components/settings-sidebar";
import { useSidebar } from "~/app/_components/sidebar";

export function ProtectedSidebar() {
  const pathname = usePathname();
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const isSettings = pathname.startsWith("/settings");

  // Render the sidebar variant in a separate state so we can defer the
  // swap until the mobile Sheet finishes closing. Swapping while the Sheet
  // is mid-open unmounts Radix Dialog before its body-style cleanup runs,
  // which leaves the page unresponsive in iOS standalone PWA mode.
  const [renderedIsSettings, setRenderedIsSettings] = useState(isSettings);

  // Close the mobile sidebar after navigating — on desktop the sidebar stays
  // pinned, but on mobile it overlays content and should dismiss on selection.
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile]);

  useEffect(() => {
    if (renderedIsSettings === isSettings) return;
    if (isMobile && openMobile) return;
    // Intentional: the swap is deferred until the mobile Sheet has finished
    // closing (see note above), which can only be observed from an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRenderedIsSettings(isSettings);
  }, [isSettings, renderedIsSettings, isMobile, openMobile]);

  return renderedIsSettings ? <SettingsSidebar /> : <AppSidebar />;
}
