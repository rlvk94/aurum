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
  CircleDollarSign,
  PiggyBank,
  Target,
} from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import { Badge } from "~/app/_components/badge";
import { Skeleton } from "~/app/_components/skeleton";
import { cn } from "~/app/_lib/utils";

type Challenge = RouterOutputs["challenge"]["list"][number];

const challengeTypeIcon = {
  spend_less: TrendingDown,
  savings: PiggyBank,
  pay_off_loan: CircleDollarSign,
  net_worth_goal: TrendingUp,
} as const;

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return value < 0 ? `-${formatted} kr.` : `${formatted} kr.`;
}

function ChallengeRow({ challenge }: { challenge: Challenge }) {
  const t = useTranslations("budgets");
  const Icon = challengeTypeIcon[challenge.type];
  const isSpendLess = challenge.type === "spend_less";
  const todayIso = new Date().toISOString().slice(0, 10);
  const notStarted = challenge.currentInstance
    ? challenge.currentInstance.periodStart > todayIso
    : false;
  const ratio =
    challenge.targetAmount > 0
      ? Math.max(0, challenge.progress) / challenge.targetAmount
      : 0;
  const pct = notStarted ? 0 : Math.min(100, Math.round(ratio * 100));
  const isOver = isSpendLess && challenge.progress > challenge.targetAmount;
  const met = isSpendLess
    ? challenge.progress <= challenge.targetAmount
    : challenge.progress >= challenge.targetAmount;

  const color = notStarted
    ? "bg-muted-foreground/30"
    : isSpendLess
      ? isOver
        ? "bg-expense"
        : "bg-primary"
      : met
        ? "bg-income"
        : "bg-primary";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="truncate text-sm font-medium text-foreground">
            {challenge.name}
          </p>
          <Badge
            variant={notStarted ? "outline" : "secondary"}
            className="shrink-0 text-[10px]"
          >
            {notStarted
              ? t("challengeNotStarted")
              : t(`challengeRepetitions.${challenge.repetition}`)}
          </Badge>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatAmount(challenge.progress)} /{" "}
          {formatAmount(challenge.targetAmount)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
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

  const tBudgets = useTranslations("budgets");

  const { data: summary } = api.financialAccount.summary.useQuery();
  const { data: assetsSummary } = api.asset.summary.useQuery();
  const { data: debtSummary } = api.debt.summary.useQuery();
  const { data: weeklyExpense } = api.transaction.weeklyExpense.useQuery();
  const { data: accounts = [] } = api.financialAccount.list.useQuery();
  const { data: recent, isLoading: recentLoading } =
    api.transaction.list.useQuery({ limit: 5 });
  const { data: challenges } = api.challenge.list.useQuery();
  const activeChallenges = (challenges ?? []).slice(0, 4);

  const netWorth =
    summary && assetsSummary && debtSummary
      ? summary.netWorthBalance + assetsSummary.total - debtSummary.totalOutstanding
      : undefined;

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <div
        data-tour-id="stats"
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
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
          value={
            debtSummary ? formatAmount(debtSummary.totalOutstanding) : "–"
          }
          icon={TrendingDown}
          className="text-debt"
        />
        <StatCard
          title={t("netWorth")}
          value={netWorth !== undefined ? formatAmount(netWorth) : "–"}
          icon={TrendingUp}
          className="text-income"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-tour-id="recent-transactions">
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

        <Card data-tour-id="challenges">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {tBudgets("challenges")}
            </CardTitle>
            <Link
              href="/budgets/challenges"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              →
            </Link>
          </CardHeader>
          <CardContent>
            {activeChallenges.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <Target className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {tBudgets("challengesEmptyState")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeChallenges.map((c) => (
                  <ChallengeRow key={c.id} challenge={c} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
