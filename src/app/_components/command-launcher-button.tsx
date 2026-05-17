"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useCommandPalette } from "~/app/_components/command-palette";
import { Kbd, KbdGroup } from "~/app/_components/kbd";
import { cn } from "~/app/_lib/utils";

export function CommandLauncherButton() {
  const { setOpen } = useCommandPalette();
  const t = useTranslations();
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
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "inline-flex h-9 w-64 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "max-md:h-11 max-md:w-11 max-md:justify-center max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:text-foreground max-md:shadow-none",
      )}
      aria-label={t("commandPalette.launcherAriaLabel")}
    >
      <Search className="h-4 w-4 shrink-0 max-md:h-5 max-md:w-5" />
      <span className="flex-1 truncate text-left max-md:hidden">
        {t("commandPalette.launcherPlaceholder")}
      </span>
      <KbdGroup className="max-md:hidden">
        <Kbd>{modKey}</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    </button>
  );
}
