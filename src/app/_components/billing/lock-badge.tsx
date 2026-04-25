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
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary/30 bg-primary/10 text-primary",
        className,
      )}
    >
      <Lock aria-hidden className="size-2.5" />
    </span>
  );
}
