"use client";

import { useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";

import { api } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
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

  const { data: accounts } = api.financialAccount.summary.useQuery();
  const { data: assets } = api.asset.summary.useQuery();
  const { data: debts } = api.debt.summary.useQuery();

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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("accountBalances")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-display text-2xl">
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
            <div className="font-display text-2xl">
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
            <div className="font-display text-2xl text-debt">
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
            <div className="font-display text-2xl text-income">
              {netWorth !== undefined ? formatAmount(netWorth) : "–"}
            </div>
          </CardContent>
        </Card>
      </div>

      {isEmpty && <EmptyState icon={TrendingUp} message={t("emptyState")} />}
    </div>
  );
}
