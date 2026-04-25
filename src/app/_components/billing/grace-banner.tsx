"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { api } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { cn } from "~/app/_lib/utils";

function daysUntil(date: Date): number {
  return Math.max(
    0,
    Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
}

export function GraceBanner({ className }: { className?: string }) {
  const t = useTranslations("billing.graceBanner");
  const { data } = api.billing.current.useQuery(undefined, {
    staleTime: 60 * 1000,
  });

  const grace = data?.graceEndsAt ? new Date(data.graceEndsAt) : null;
  if (!grace || grace <= new Date()) return null;

  const days = daysUntil(grace);

  return (
    <div
      className={cn(
        "border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning-foreground",
        className,
      )}
      role="status"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div>
          <strong className="font-medium">{t("title")}</strong>{" "}
          <span className="text-muted-foreground">
            {t("body", { days })}
          </span>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/settings/billing">{t("cta")}</Link>
        </Button>
      </div>
    </div>
  );
}

export function PendingBillingBanner({ className }: { className?: string }) {
  const t = useTranslations("billing.pendingBanner");
  const { data } = api.billing.current.useQuery(undefined, {
    staleTime: 60 * 1000,
  });

  if (!data?.pendingCheckout || data.plan === "family") return null;

  return (
    <div
      className={cn(
        "border-b border-primary/30 bg-primary/5 px-4 py-2 text-sm",
        className,
      )}
      role="status"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div>
          <strong className="font-medium">{t("title")}</strong>{" "}
          <span className="text-muted-foreground">{t("body")}</span>
        </div>
        <Button asChild size="sm" variant="default">
          <Link href="/settings/billing">{t("cta")}</Link>
        </Button>
      </div>
    </div>
  );
}
