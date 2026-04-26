"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";

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
import { PaymentForm } from "~/app/_components/billing/payment-form";

type Cadence = "monthly" | "annual";
type Step = "cadence" | "payment" | "activating";

const ACTIVATION_POLL_INTERVAL_MS = 2000;
const ACTIVATION_TIMEOUT_MS = 30000;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Two-step picker: choose cadence, then enter card via embedded
 * <PaymentElement />. Activation is reflected through the billing webhook;
 * the parent screen polls `billing.current` for status flips.
 */
export function CadenceDialog({ open, onOpenChange }: Props) {
  const t = useTranslations("billing.cadenceDialog");
  const tPricing = useTranslations("landing.pricing.plans.family");
  const tCommon = useTranslations("common");

  const [cadence, setCadence] = useState<Cadence>("annual");
  const [step, setStep] = useState<Step>("cadence");
  const [paymentInfo, setPaymentInfo] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setIsDark(document.documentElement.classList.contains("dark"));
  }, [open]);

  const utils = api.useUtils();

  const createSubscription = api.billing.createSubscription.useMutation({
    onSuccess: ({ clientSecret, publishableKey }) => {
      setPaymentInfo({ clientSecret, publishableKey });
      setStep("payment");
    },
  });

  const billingCurrent = api.billing.current.useQuery(undefined, {
    enabled: open,
    refetchInterval: step === "activating" ? ACTIVATION_POLL_INTERVAL_MS : false,
  });

  // Status flipped to active by webhook → close dialog and let parent re-render.
  useEffect(() => {
    if (
      step === "activating" &&
      billingCurrent.data?.status === "active" &&
      !finishedRef.current
    ) {
      finishedRef.current = true;
      void utils.billing.current.invalidate();
      onOpenChange(false);
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, billingCurrent.data?.status]);

  // Activation timeout fallback.
  useEffect(() => {
    if (step !== "activating") return;
    const timer = setTimeout(() => {
      if (!finishedRef.current) {
        setActivationError(t("activationTimedOut"));
        setStep("payment");
      }
    }, ACTIVATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function reset() {
    setStep("cadence");
    setPaymentInfo(null);
    setActivationError(null);
    finishedRef.current = false;
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handlePaymentSuccess() {
    setStep("activating");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {step === "cadence" && (
          <>
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

            {createSubscription.error && (
              <p className="text-sm text-destructive" role="alert">
                {createSubscription.error.message}
              </p>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button
                onClick={() => createSubscription.mutate({ cadence })}
                disabled={createSubscription.isPending}
              >
                {createSubscription.isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {tCommon("loading")}
                  </>
                ) : (
                  t("cta")
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "payment" && paymentInfo && (
          <>
            <DialogHeader>
              <DialogTitle>{t("paymentTitle")}</DialogTitle>
              <DialogDescription>{t("paymentBody")}</DialogDescription>
            </DialogHeader>

            <PaymentForm
              clientSecret={paymentInfo.clientSecret}
              publishableKey={paymentInfo.publishableKey}
              returnUrl={
                typeof window !== "undefined"
                  ? `${window.location.origin}/settings/billing`
                  : "/settings/billing"
              }
              onSuccess={handlePaymentSuccess}
              isDark={isDark}
            />

            {activationError && (
              <p className="text-sm text-destructive" role="alert">
                {activationError}
              </p>
            )}

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("cadence");
                  setActivationError(null);
                }}
              >
                {t("back")}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "activating" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("activatingTitle")}</DialogTitle>
              <DialogDescription>{t("activatingBody")}</DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          </>
        )}
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
