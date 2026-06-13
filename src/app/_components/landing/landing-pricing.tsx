"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "~/app/_components/button";
import { cn } from "~/app/_lib/utils";
import { PLAN_DISPLAY_BULLETS } from "~/server/billing/plans";
import { SectionMarker } from "./section-marker";

type Cadence = "monthly" | "annual";

export function LandingPricing({ isAuthed }: { isAuthed: boolean }) {
  const t = useTranslations("landing.pricing");
  const [cadence, setCadence] = useState<Cadence>("monthly");

  const plans = [
    { key: "individual", recommended: false },
    { key: "family", recommended: true },
  ] as const;

  const ctaHref = isAuthed ? "/dashboard" : "/login";
  const ctaLabel = isAuthed ? t("ctaAuthed") : t("cta");

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <header className="max-w-2xl">
          <SectionMarker>{t("marker")}</SectionMarker>
          <h2 className="font-display text-foreground mt-4 text-4xl leading-tight sm:text-5xl">
            {t("heading")}
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">
            {t("lead")}
          </p>

          {/* Cadence toggle */}
          <div className="border-border bg-card shadow-card mt-8 inline-flex items-center gap-1 rounded-full border p-1">
            {(["monthly", "annual"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCadence(c)}
                className={cn(
                  "almanac-smallcaps relative rounded-full px-4 py-1.5 text-[10px] tracking-[0.22em] transition-colors",
                  cadence === c
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`toggle.${c}`)}
                {c === "annual" && cadence !== "annual" && (
                  <span className="almanac-smallcaps text-primary ml-2 text-[8px] tracking-[0.2em]">
                    · {t("toggle.savings")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        <div className="border-border bg-card shadow-card mt-12 grid grid-cols-1 overflow-hidden rounded-xl border md:grid-cols-2">
          {plans.map((p, i) => (
            <PricingPlan
              key={p.key}
              planKey={p.key}
              recommended={p.recommended}
              cadence={cadence}
              ctaHref={ctaHref}
              ctaLabel={ctaLabel}
              isLast={i === plans.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingPlan({
  planKey,
  recommended,
  cadence,
  ctaHref,
  ctaLabel,
  isLast,
}: {
  planKey: "individual" | "family";
  recommended: boolean;
  cadence: Cadence;
  ctaHref: string;
  ctaLabel: string;
  isLast: boolean;
}) {
  const t = useTranslations("landing.pricing");
  const tPlan = useTranslations(`landing.pricing.plans.${planKey}`);
  const tFeatures = useTranslations("billing.planFeatures");
  const features = PLAN_DISPLAY_BULLETS[planKey].map((k) => tFeatures(k));

  const price = cadence === "annual" ? tPlan("priceAnnual") : tPlan("price");
  const billed =
    cadence === "annual" ? t("billedAnnually") : t("billedMonthly");

  return (
    <div
      className={cn(
        "relative flex flex-col p-8 sm:p-10",
        !isLast && "border-border md:border-r",
        recommended && "bg-(--accent)",
      )}
    >
      {recommended && (
        <span className="almanac-smallcaps border-primary/30 bg-primary/10 text-primary absolute top-4 right-4 rounded-sm border px-2 py-0.5 text-[9px] tracking-[0.22em]">
          {t("recommended")}
        </span>
      )}

      <div>
        <div className="font-display text-foreground text-2xl">
          {tPlan("name")}
        </div>
        <div className="almanac-smallcaps text-muted-foreground mt-1 text-[10px] tracking-[0.22em]">
          {tPlan("tagline")}
        </div>
      </div>

      <div className="mt-6 flex items-baseline gap-2">
        <span className="almanac-numerals font-display text-foreground text-5xl">
          {price}
        </span>
        <span className="almanac-smallcaps text-muted-foreground text-[11px] tracking-[0.18em]">
          {t("perMonth")}
        </span>
      </div>
      <div className="almanac-smallcaps text-muted-foreground mt-1 text-[10px] tracking-[0.18em]">
        {billed}
      </div>

      <div className="almanac-rule my-6" />

      <ul className="flex-1 space-y-3 text-sm">
        {features.map((f, i) => (
          <li key={i} className="text-foreground flex items-start gap-3">
            <span
              aria-hidden
              className="bg-primary mt-2 block h-px w-3 shrink-0"
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Button
        asChild
        size="lg"
        variant={recommended ? "default" : "outline"}
        className="mt-8 w-full"
      >
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}
