"use client";

import { useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";

import { api } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { FamilyFeatureTeaser } from "~/app/_components/billing/family-feature-teaser";
import { useEntitlements } from "~/app/_hooks/use-entitlements";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return value < 0 ? `-${formatted} kr.` : `${formatted} kr.`;
}

export function NetWorthClient() {
  const t = useTranslations("netWorth");
  const tTeaser = useTranslations("billing.featureCopy.netWorth");
  const { has } = useEntitlements();

  const { data: accounts } = api.financialAccount.summary.useQuery(undefined, {
    enabled: has("netWorth"),
  });
  const { data: assets } = api.asset.summary.useQuery(undefined, {
    enabled: has("netWorth"),
  });
  const { data: debts } = api.debt.summary.useQuery(undefined, {
    enabled: has("netWorth"),
  });

  if (!has("netWorth")) {
    let bullets: string[] = [];
    try {
      bullets = (tTeaser.raw("bullets") as string[]) ?? [];
    } catch {
      bullets = [];
    }
    return <FamilyFeatureTeaser feature="netWorth" bullets={bullets} />;
  }

  const ready = accounts && assets && debts;
  const netWorth = ready
    ? accounts.netWorthBalance + assets.total - debts.totalOutstanding
    : undefined;

  const isEmpty =
    ready &&
    accounts.netWorthBalance === 0 &&
    assets.total === 0 &&
    debts.totalOutstanding === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("accountBalances")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-xl break-words sm:text-2xl">
              {accounts ? formatAmount(accounts.netWorthBalance) : "–"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalAssets")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-xl break-words sm:text-2xl">
              {assets ? formatAmount(assets.total) : "–"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalDebts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-xl break-words text-debt sm:text-2xl">
              {debts ? formatAmount(debts.totalOutstanding) : "–"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("netWorthValue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-xl break-words text-income sm:text-2xl">
              {netWorth !== undefined ? formatAmount(netWorth) : "–"}
            </div>
          </CardContent>
        </Card>
      </div>

      {isEmpty && <EmptyState icon={TrendingUp} message={t("emptyState")} />}
    </div>
  );
}
