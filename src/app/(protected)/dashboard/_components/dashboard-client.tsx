"use client";

import { useTranslations, useLocale } from "next-intl";
import { format, parse } from "date-fns";
import { da, enUS } from "date-fns/locale";
import Link from "next/link";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  ArrowLeftRight,
} from "lucide-react";
import { api } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import { Skeleton } from "~/app/_components/skeleton";
import { cn } from "~/app/_lib/utils";

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return value < 0 ? `-${formatted} kr.` : `${formatted} kr.`;
}

function StatCard({
  title,
  value,
  icon: Icon,
  className,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${className ?? "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="font-display text-2xl">{value}</div>
      </CardContent>
    </Card>
  );
}

export function DashboardClient() {
  const t = useTranslations("dashboard");
  const tTx = useTranslations("transactions");
  const locale = useLocale();
  const dateLocale = locale === "da" ? da : enUS;

  const { data: summary } = api.financialAccount.summary.useQuery();
  const { data: weeklyExpense } = api.transaction.weeklyExpense.useQuery();
  const { data: accounts = [] } = api.financialAccount.list.useQuery();
  const { data: recent, isLoading: recentLoading } =
    api.transaction.list.useQuery({ limit: 5 });

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("weeklySpent")}
          value={weeklyExpense !== undefined ? formatAmount(weeklyExpense) : "–"}
          icon={ArrowLeftRight}
          className="text-expense"
        />
        <StatCard
          title={t("totalBalance")}
          value={summary ? formatAmount(summary.totalBalance) : "–"}
          icon={Wallet}
        />
        <StatCard
          title={t("totalDebt")}
          value="–"
          icon={TrendingDown}
          className="text-debt"
        />
        <StatCard
          title={t("netWorth")}
          value={summary ? formatAmount(summary.netWorthBalance) : "–"}
          icon={TrendingUp}
          className="text-income"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{t("recentTransactions")}</CardTitle>
            <Link
              href="/transactions"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              →
            </Link>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3"
                  >
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : recent && recent.length > 0 ? (
              <div className="space-y-3">
                {recent.map((tx) => {
                  const dateObj = parse(tx.date, "yyyy-MM-dd", new Date());
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="w-20 whitespace-nowrap text-muted-foreground">
                        {format(dateObj, "d. MMM", { locale: dateLocale })}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {tx.description}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {accountMap.get(tx.accountId) ?? "—"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "whitespace-nowrap font-medium",
                          tx.type === "expense" && "text-expense",
                          tx.type === "income" && "text-income",
                          tx.type === "transfer" && "text-savings",
                        )}
                      >
                        {tx.type === "expense" && "-"}
                        {tx.type === "income" && "+"}
                        {formatAmount(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {tTx("emptyState")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("budgetStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">–</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
