"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

import { api } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { Button } from "~/app/_components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import { CadenceDialog } from "~/app/_components/billing/cadence-dialog";
import { PLAN_DISPLAY_BULLETS } from "~/server/billing/plans";

function formatDate(value: Date | string | null, locale: string): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString(locale === "da" ? "da-DK" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function BillingForm() {
  const t = useTranslations("billing.settings");
  const tUpgrade = useTranslations("billing.settings.upgradeCard");
  const tPricing = useTranslations("landing.pricing");
  const tFamilyPlan = useTranslations("landing.pricing.plans.family");
  const tFeatures = useTranslations("billing.planFeatures");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const utils = api.useUtils();

  const { data: billing, isLoading } = api.billing.current.useQuery();

  const [cadenceOpen, setCadenceOpen] = useState(false);

  const portal = api.billing.createPortalSession.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });
  const selectIndividual = api.billing.selectIndividual.useMutation({
    onSuccess: () => {
      void utils.billing.current.invalidate();
    },
  });

  const planLabel =
    billing?.plan === "family"
      ? tPricing("plans.family.name")
      : tPricing("plans.individual.name");

  const features = PLAN_DISPLAY_BULLETS.family.map((k) => tFeatures(k));

  function describeStatus(): string {
    if (isLoading) return tCommon("loading");
    if (!billing) return "";
    if (billing.plan === "individual") return t("individualPlanDescription");
    if (billing.cancelAtPeriodEnd && billing.currentPeriodEnd) {
      return t("familyPlanDescriptionCanceled", {
        date: formatDate(billing.currentPeriodEnd, locale),
      });
    }
    if (
      (billing.status === "past_due" || billing.status === "unpaid") &&
      billing.graceEndsAt
    ) {
      return t("familyPlanDescriptionPastDue", {
        date: formatDate(billing.graceEndsAt, locale),
      });
    }
    if (billing.currentPeriodEnd) {
      return t("familyPlanDescriptionActive", {
        date: formatDate(billing.currentPeriodEnd, locale),
      });
    }
    return "";
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("currentPlan")}</CardTitle>
          <CardDescription>{describeStatus()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="font-display text-2xl">{planLabel}</div>
            {billing?.cadence && billing.plan === "family" && (
              <div className="text-muted-foreground text-xs">
                {billing.cadence === "annual"
                  ? tPricing("billedAnnually")
                  : tPricing("billedMonthly")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {billing?.plan === "family" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("manageInStripe")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => portal.mutate()} disabled={portal.isPending}>
              {portal.isPending ? tCommon("loading") : t("manageInStripe")}
            </Button>
          </CardContent>
        </Card>
      )}

      {billing?.plan === "individual" && (
        <UpgradeCard
          features={features}
          onUpgrade={() => setCadenceOpen(true)}
          eyebrow={tUpgrade("eyebrow")}
          heading={tUpgrade("heading")}
          body={tUpgrade("body")}
          pricePrefix={tUpgrade("pricePrefix")}
          priceSuffix={tUpgrade("priceSuffix")}
          priceAnnual={tFamilyPlan("priceAnnual")}
          ctaLabel={tUpgrade("cta")}
          showResetIndividual={billing?.status !== "none"}
          onResetIndividual={() => selectIndividual.mutate()}
          resetting={selectIndividual.isPending}
          resetLabel={t("onIndividualPlan")}
        />
      )}

      <CadenceDialog open={cadenceOpen} onOpenChange={setCadenceOpen} />
    </div>
  );
}

function UpgradeCard({
  features,
  onUpgrade,
  eyebrow,
  heading,
  body,
  pricePrefix,
  priceSuffix,
  priceAnnual,
  ctaLabel,
  showResetIndividual,
  onResetIndividual,
  resetting,
  resetLabel,
}: {
  features: string[];
  onUpgrade: () => void;
  eyebrow: string;
  heading: string;
  body: string;
  pricePrefix: string;
  priceSuffix: string;
  priceAnnual: string;
  ctaLabel: string;
  showResetIndividual: boolean;
  onResetIndividual: () => void;
  resetting: boolean;
  resetLabel: string;
}) {
  return (
    <div className="border-border bg-card shadow-card relative overflow-hidden rounded-xl border p-8 sm:p-10">
      <div
        aria-hidden
        className="bg-primary/10 pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="bg-accent pointer-events-none absolute bottom-0 -left-12 h-32 w-32 rounded-full opacity-60 blur-3xl"
      />

      <div className="relative space-y-6">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary size-4" />
          <span className="almanac-smallcaps border-primary/30 bg-primary/10 text-primary rounded-sm border px-2 py-0.5 text-[10px] tracking-[0.22em]">
            {eyebrow}
          </span>
        </div>

        <div>
          <h2 className="font-display text-foreground text-3xl leading-tight tracking-tight sm:text-4xl">
            {heading}
          </h2>
          <p className="text-muted-foreground mt-3 text-base">{body}</p>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-muted-foreground text-xs tracking-wider uppercase">
            {pricePrefix}
          </span>
          <span className="font-display text-foreground text-3xl">
            {priceAnnual}
          </span>
          <span className="text-muted-foreground text-sm">{priceSuffix}</span>
        </div>

        {features.length > 0 && (
          <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {features.map((f, i) => (
              <li key={i} className="text-foreground/90 flex items-start gap-2">
                <span
                  aria-hidden
                  className="bg-primary mt-2 block h-px w-3 shrink-0"
                />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button onClick={onUpgrade} size="lg">
            {ctaLabel}
          </Button>
          {showResetIndividual && (
            <Button
              variant="ghost"
              onClick={onResetIndividual}
              disabled={resetting}
            >
              {resetLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
