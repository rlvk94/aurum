"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, X } from "lucide-react";

import { Button } from "~/app/_components/button";
import { usePushSubscription } from "~/app/_hooks/use-push-subscription";

// Per-browser dismissal: localStorage is already scoped to origin + browser,
// so a single flag means "dismissed on this device". Permanent (no cooldown) —
// the always-visible control lives on the notifications settings page.
const DISMISSED_STORAGE_KEY = "push-banner-dismissed";

export function PushBanner() {
  const t = useTranslations("dashboard.pushBanner");
  const push = usePushSubscription();

  const [mounted, setMounted] = useState(false);
  // Assume dismissed until the effect reads localStorage — avoids a flash of
  // the banner before we know the user's choice.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage is client-only */
    setMounted(true);
    try {
      setDismissed(
        globalThis.localStorage.getItem(DISMISSED_STORAGE_KEY) === "1",
      );
    } catch {
      setDismissed(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const canEnable =
    push.supported &&
    push.configured &&
    push.permission !== "denied" &&
    !(push.isIos && !push.isStandalone);

  const show = mounted && !dismissed && canEnable && !push.isSubscribed;
  if (!show) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      globalThis.localStorage.setItem(DISMISSED_STORAGE_KEY, "1");
    } catch {
      // ignore: dismissal just won't persist if storage is unavailable
    }
  };

  return (
    <div className="border-primary/30 bg-primary/5 flex items-start gap-4 rounded-lg border p-4">
      <div className="bg-primary/10 text-primary mt-0.5 grid size-9 shrink-0 place-items-center rounded-full">
        <Bell className="size-5" />
      </div>
      <div className="flex-1 space-y-1">
        <h3 className="text-foreground text-lg font-semibold">{t("title")}</h3>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
        <div className="flex flex-col gap-2 pt-3 sm:flex-row">
          <Button
            size="sm"
            className="w-full sm:w-auto"
            disabled={push.isBusy}
            onClick={() => void push.subscribe()}
          >
            <Bell />
            {push.isBusy ? t("enabling") : t("enable")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleDismiss}
          >
            {t("dismiss")}
          </Button>
        </div>
      </div>
      <button
        type="button"
        aria-label={t("dismiss")}
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
