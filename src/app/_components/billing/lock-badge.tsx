"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "~/app/_lib/utils";

type Props = {
  className?: string;
};

/**
 * Small lock chip used to mark Family-only features in nav, buttons, and
 * teasers. Visual cue that something exists but requires upgrade.
 */
export function LockBadge({ className }: Props) {
  const t = useTranslations("billing.lockBadge");
  return (
    <span
      aria-label={t("label")}
      title={t("label")}
      className={cn(
        "border-primary/30 bg-primary/10 text-primary inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
        className,
      )}
    >
      <Lock aria-hidden className="size-3" />
    </span>
  );
}
