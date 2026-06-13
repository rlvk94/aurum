"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

import { Button } from "~/app/_components/button";
import { useUpgradeModal } from "~/app/_components/billing/upgrade-modal";
import { LockBadge } from "~/app/_components/billing/lock-badge";

type Props = {
  feature: string;
  bullets?: string[];
};

/**
 * Page-level teaser shown when an Individual family lands on a Family-only
 * screen. Surfaces what the feature does + a single CTA into the upgrade
 * modal.
 */
export function FamilyFeatureTeaser({ feature, bullets }: Props) {
  const t = useTranslations("billing.featureCopy");
  const tShell = useTranslations("billing.teaser");
  const upgrade = useUpgradeModal();

  const title = (() => {
    try {
      return t(`${feature}.title`);
    } catch {
      return tShell("genericTitle");
    }
  })();
  const body = (() => {
    try {
      return t(`${feature}.body`);
    } catch {
      return tShell("genericBody");
    }
  })();

  return (
    <div className="border-border bg-card shadow-card mx-auto flex w-full max-w-2xl flex-col items-start gap-6 rounded-xl border p-8 sm:p-10">
      <div className="flex items-center gap-2">
        <Sparkles className="text-primary size-5" />
        <LockBadge />
      </div>
      <div>
        <h1 className="font-display text-foreground text-3xl leading-tight tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="text-muted-foreground mt-3 text-base">{body}</p>
      </div>
      {bullets && bullets.length > 0 && (
        <ul className="text-foreground/90 space-y-2 text-sm">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                aria-hidden
                className="bg-primary mt-2 block h-px w-3 shrink-0"
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      <Button onClick={() => upgrade.open(feature)} size="lg">
        {tShell("cta")}
      </Button>
    </div>
  );
}
