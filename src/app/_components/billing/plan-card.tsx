"use client";

import { useTranslations } from "next-intl";

import { cn } from "~/app/_lib/utils";
import { PLAN_DISPLAY_BULLETS } from "~/server/billing/plans";

type Cadence = "monthly" | "annual";

type Props = {
  planKey: "individual" | "family";
  cadence: Cadence;
  selected: boolean;
  onSelect: () => void;
};

/**
 * Compact plan card for the onboarding wizard / settings upgrade flow.
 * Bullets come from PLAN_DISPLAY_BULLETS so the landing page and the in-app
 * surfaces stay in sync.
 */
export function PlanCard({ planKey, cadence, selected, onSelect }: Props) {
  const t = useTranslations("landing.pricing");
  const tPlan = useTranslations(`landing.pricing.plans.${planKey}`);
  const tFeatures = useTranslations("billing.planFeatures");
  const features = PLAN_DISPLAY_BULLETS[planKey].map((k) => tFeatures(k));
  const price = cadence === "annual" ? tPlan("priceAnnual") : tPlan("price");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-5 text-left transition-all",
        selected
          ? "border-primary bg-accent shadow-card"
          : "border-border hover:border-primary/40",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-display text-xl text-foreground">
          {tPlan("name")}
        </div>
        {planKey === "family" && (
          <span className="almanac-smallcaps rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] tracking-[0.22em] text-primary">
            {t("recommended")}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-display text-3xl">{price}</span>
        <span className="text-xs text-muted-foreground">{t("perMonth")}</span>
      </div>
      <ul className="space-y-1.5 text-xs text-foreground/80">
        {features.slice(0, 5).map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span aria-hidden className="mt-1.5 block h-px w-2 shrink-0 bg-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}
