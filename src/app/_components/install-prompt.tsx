"use client";

import {
  ArrowRightIcon,
  EllipsisVerticalIcon,
  MonitorDownIcon,
  ShareIcon,
  SquarePlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "~/app/_components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "~/app/_components/drawer";

const DISMISSED_STORAGE_KEY = "install-prompt-dismissed-at";
const DISMISSAL_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 30;

export const InstallPrompt = () => {
  const t = useTranslations("install");
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isMobile = isAndroid || isIOS;
    const isStandalone =
      globalThis.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && navigator.standalone === true);

    if (!isMobile || isStandalone) {
      return;
    }

    let dismissedAt = 0;
    try {
      dismissedAt = Number(
        globalThis.localStorage.getItem(DISMISSED_STORAGE_KEY),
      );
    } catch (error) {
      console.debug("install-prompt: localStorage read failed", error);
    }
    const recentlyDismissed =
      Number.isFinite(dismissedAt) &&
      dismissedAt > 0 &&
      Date.now() - dismissedAt < DISMISSAL_COOLDOWN_MS;

    if (recentlyDismissed) {
      return;
    }

    setPlatform(isAndroid ? "android" : "ios");
    setVisible(true);
  }, []);

  const handleOpenChange = (open: boolean) => {
    setVisible(open);
    if (!open) {
      try {
        globalThis.localStorage.setItem(
          DISMISSED_STORAGE_KEY,
          String(Date.now()),
        );
      } catch (error) {
        console.debug("install-prompt: localStorage write failed", error);
      }
    }
  };

  return (
    <Drawer open={visible} onOpenChange={handleOpenChange}>
      <DrawerContent className="safe-bottom">
        <DrawerHeader>
          <DrawerTitle>{t("title")}</DrawerTitle>
          <DrawerDescription>{t("description")}</DrawerDescription>
        </DrawerHeader>
        <div className="mx-4 flex items-center justify-center gap-4 rounded-xl bg-muted py-8">
          {platform === "ios" ? (
            <>
              <div className="flex w-14 flex-col items-center gap-2 text-center">
                <Image
                  src="/safari-logo.png"
                  alt="Safari logo"
                  width={56}
                  height={56}
                  className="size-14"
                />
                <p className="text-sm">Safari</p>
              </div>
              <ArrowRightIcon className="mb-6 size-6 text-muted-foreground" />
              <div className="flex w-14 flex-col items-center gap-2 text-center">
                <div className="grid size-14 place-items-center rounded-xl bg-background">
                  <ShareIcon className="size-6 text-blue-500" />
                </div>
                <p className="text-sm">{t("share")}</p>
              </div>
              <ArrowRightIcon className="mb-6 size-6 text-muted-foreground" />
              <div className="flex w-14 flex-col items-center gap-2 text-center">
                <div className="grid size-14 place-items-center rounded-xl bg-background">
                  <SquarePlus className="size-6" />
                </div>
                <p className="text-sm">{t("addToHomescreen")}</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex w-14 flex-col items-center gap-2 text-center">
                <div className="size-14 rounded-xl bg-background p-1">
                  <Image
                    src="/chrome-logo.png"
                    alt="Chrome logo"
                    width={56}
                    height={56}
                  />
                </div>
                <p className="text-sm">Chrome</p>
              </div>
              <ArrowRightIcon className="mb-6 size-6 text-muted-foreground" />
              <div className="flex w-14 flex-col items-center gap-2 text-center">
                <div className="grid size-14 place-items-center rounded-xl bg-background">
                  <EllipsisVerticalIcon className="size-6" />
                </div>
                <p className="text-sm">{t("menu")}</p>
              </div>
              <ArrowRightIcon className="mb-6 size-6 text-muted-foreground" />
              <div className="flex w-14 flex-col items-center gap-2 text-center">
                <div className="grid size-14 place-items-center rounded-xl bg-background">
                  <MonitorDownIcon className="size-6" />
                </div>
                <p className="text-sm">{t("addToHomescreen")}</p>
              </div>
            </>
          )}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="ghost">{t("continueInBrowser")}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
