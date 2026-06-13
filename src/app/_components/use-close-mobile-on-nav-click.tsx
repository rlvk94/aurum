"use client";

import * as React from "react";

import { useSidebar } from "~/app/_components/sidebar";

/**
 * Returns an onClick handler for the sidebar nav body that dismisses the mobile
 * sheet whenever a navigation link is tapped — including the link for the page
 * you're already on, where no route change fires (so the pathname-driven close
 * in ProtectedSidebar never runs and the sheet would otherwise sit open).
 *
 * Scope it to the nav content (SidebarContent), not the whole sidebar: it keys
 * off `a[href]`, so collapsible toggles (buttons) and the footer user menu —
 * whose "Settings" entry must keep the sheet open while entering settings —
 * are unaffected.
 */
export function useCloseMobileOnNavClick() {
  const { isMobile, setOpenMobile } = useSidebar();

  return React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!isMobile) return;
      if ((event.target as HTMLElement).closest("a[href]")) {
        setOpenMobile(false);
      }
    },
    [isMobile, setOpenMobile],
  );
}
