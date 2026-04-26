"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";

import { Button } from "~/app/_components/button";

type Props = {
  clientSecret: string;
  publishableKey: string;
  returnUrl: string;
  onSuccess: () => void;
  isDark?: boolean;
};

const stripePromiseCache = new Map<string, Promise<StripeJs | null>>();

function getStripePromise(publishableKey: string): Promise<StripeJs | null> {
  let cached = stripePromiseCache.get(publishableKey);
  if (!cached) {
    cached = loadStripe(publishableKey);
    stripePromiseCache.set(publishableKey, cached);
  }
  return cached;
}

export function PaymentForm({
  clientSecret,
  publishableKey,
  returnUrl,
  onSuccess,
  isDark,
}: Props) {
  const stripePromise = useMemo(
    () => getStripePromise(publishableKey),
    [publishableKey],
  );

  const options = useMemo(
    () => ({
      clientSecret,
      appearance: {
        theme: (isDark ? "night" : "stripe") as "night" | "stripe",
        variables: {
          colorPrimary: "#c8941f",
          fontFamily: "DM Sans, system-ui, sans-serif",
          borderRadius: "8px",
        },
      },
    }),
    [clientSecret, isDark],
  );

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentFormInner returnUrl={returnUrl} onSuccess={onSuccess} />
    </Elements>
  );
}

function PaymentFormInner({
  returnUrl,
  onSuccess,
}: {
  returnUrl: string;
  onSuccess: () => void;
}) {
  const t = useTranslations("billing.paymentForm");
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!stripe || !elements) return;
    setReady(true);
  }, [stripe, elements]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message ?? t("genericError"));
      setSubmitting(false);
      return;
    }

    if (
      paymentIntent?.status === "succeeded" ||
      paymentIntent?.status === "processing"
    ) {
      onSuccess();
      return;
    }

    setError(t("genericError"));
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={!ready || submitting}
        className="h-12 w-full gap-2 rounded-full"
      >
        {submitting ? (
          <>
            <Loader2 className="animate-spin" />
            {t("processing")}
          </>
        ) : (
          t("pay")
        )}
      </Button>
    </form>
  );
}
