"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "~/app/_components/button";
import { cn } from "~/app/_lib/utils";
import { SectionMarker } from "./section-marker";

type Cadence = "monthly" | "annual";

export function LandingPricing({ isAuthed }: { isAuthed: boolean }) {
  const t = useTranslations("landing.pricing");
  const [cadence, setCadence] = useState<Cadence>("monthly");

  const plans = [
    { key: "free", recommended: false },
    { key: "pro", recommended: true },
  ] as const;

  const ctaHref = isAuthed ? "/dashboard" : "/login";
  const ctaLabel = isAuthed ? t("ctaAuthed") : t("cta");

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <header className="max-w-2xl">
          <SectionMarker>{t("marker")}</SectionMarker>
          <h2 className="mt-4 font-display text-4xl leading-tight text-foreground sm:text-5xl">
            {t("heading")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {t("lead")}
          </p>

          {/* Cadence toggle */}
          <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-card">
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
                  <span className="almanac-smallcaps ml-2 text-[8px] tracking-[0.2em] text-primary">
                    · {t("toggle.savings")}
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        <div className="mt-12 grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card shadow-card md:grid-cols-2">
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
  planKey: "free" | "pro";
  recommended: boolean;
  cadence: Cadence;
  ctaHref: string;
  ctaLabel: string;
  isLast: boolean;
}) {
  const t = useTranslations("landing.pricing");
  const tPlan = useTranslations(`landing.pricing.plans.${planKey}`);
  const features = (tPlan.raw("features") as string[]) ?? [];

  const price = cadence === "annual" ? tPlan("priceAnnual") : tPlan("price");
  const billed =
    cadence === "annual" ? t("billedAnnually") : t("billedMonthly");

  return (
    <div
      className={cn(
        "relative flex flex-col p-8 sm:p-10",
        !isLast && "md:border-r border-border",
        recommended && "bg-(--accent)",
      )}
    >
      {recommended && (
        <span className="almanac-smallcaps absolute right-4 top-4 rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] tracking-[0.22em] text-primary">
          {t("recommended")}
        </span>
      )}

      <div>
        <div className="font-display text-2xl text-foreground">{tPlan("name")}</div>
        <div className="almanac-smallcaps mt-1 text-[10px] tracking-[0.22em] text-muted-foreground">
          {tPlan("tagline")}
        </div>
      </div>

      <div className="mt-6 flex items-baseline gap-2">
        <span className="almanac-numerals font-display text-5xl text-foreground">
          {price}
        </span>
        <span className="almanac-smallcaps text-[11px] tracking-[0.18em] text-muted-foreground">
          {t("perMonth")}
        </span>
      </div>
      <div className="almanac-smallcaps mt-1 text-[10px] tracking-[0.18em] text-muted-foreground">
        {billed}
      </div>

      <div className="almanac-rule my-6" />

      <ul className="flex-1 space-y-3 text-sm">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3 text-foreground">
            <span aria-hidden className="mt-2 block h-px w-3 shrink-0 bg-primary" />
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
