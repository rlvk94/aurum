"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import { cn } from "~/app/_lib/utils";

type Cadence = "monthly" | "annual";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Two-card cadence picker (monthly / annual) shown after the user clicks
 * "Upgrade". Submits to Stripe Checkout with the chosen cadence.
 */
export function CadenceDialog({ open, onOpenChange }: Props) {
  const t = useTranslations("billing.cadenceDialog");
  const tPricing = useTranslations("landing.pricing.plans.family");
  const tCommon = useTranslations("common");

  const [cadence, setCadence] = useState<Cadence>("annual");

  const checkout = api.billing.createCheckoutSession.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CadenceOption
            selected={cadence === "monthly"}
            onSelect={() => setCadence("monthly")}
            heading={t("monthlyHeading")}
            price={t("monthlyPrice", { price: tPricing("price") })}
            subtext={t("monthlySubtext")}
          />
          <CadenceOption
            selected={cadence === "annual"}
            onSelect={() => setCadence("annual")}
            heading={t("annualHeading")}
            price={t("annualPrice", { price: tPricing("priceAnnual") })}
            subtext={t("annualSubtext")}
            recommended
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            onClick={() => checkout.mutate({ cadence })}
            disabled={checkout.isPending}
          >
            {checkout.isPending ? tCommon("loading") : t("cta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CadenceOption({
  selected,
  onSelect,
  heading,
  price,
  subtext,
  recommended,
}: {
  selected: boolean;
  onSelect: () => void;
  heading: string;
  price: string;
  subtext: string;
  recommended?: boolean;
}) {
  const t = useTranslations("landing.pricing");
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative flex flex-col gap-1 rounded-lg border p-4 text-left transition-all",
        selected
          ? "border-primary bg-accent shadow-card"
          : "border-border hover:border-primary/40",
      )}
    >
      {recommended && (
        <span className="almanac-smallcaps absolute right-3 top-3 rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[8px] tracking-[0.22em] text-primary">
          {t("recommended")}
        </span>
      )}
      <div className="text-sm font-medium text-foreground">{heading}</div>
      <div className="font-display text-2xl text-foreground">{price}</div>
      <div className="text-xs text-muted-foreground">{subtext}</div>
      {selected && (
        <span className="mt-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" />
        </span>
      )}
    </button>
  );
}
