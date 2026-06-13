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
  BookOpen,
  FolderHeart,
  Lock,
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
import { Button } from "~/app/_components/button";
import { LockBadge } from "~/app/_components/billing/lock-badge";
import { useUpgradeModal } from "~/app/_components/billing/upgrade-modal";
import { useEntitlements } from "~/app/_hooks/use-entitlements";
import { cn } from "~/app/_lib/utils";
import type { BooleanFeatureKey } from "~/server/billing/plans";
import { deriveProgress } from "~/app/(protected)/projects/_lib/format";
import { PushBanner } from "./push-banner";

type Challenge = RouterOutputs["challenge"]["list"][number];
type Budget = RouterOutputs["budget"]["list"][number];
type Project = RouterOutputs["project"]["list"][number];

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
    <Link
      href={`/budgets/challenges/${challenge.id}`}
      className="hover:bg-accent/40 block space-y-2 rounded-md transition-colors"
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="bg-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-md sm:h-7 sm:w-7">
          <Icon className="text-primary h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </div>
        <p className="text-foreground min-w-0 flex-1 truncate text-base font-medium sm:text-sm">
          {challenge.name}
        </p>
        <Badge
          variant={notStarted ? "outline" : "secondary"}
          className="shrink-0 text-xs sm:text-[10px]"
        >
          {notStarted
            ? t("challengeNotStarted")
            : t(`challengeRepetitions.${challenge.repetition}`)}
        </Badge>
      </div>
      <div className="text-muted-foreground text-base tabular-nums sm:text-sm">
        {formatAmount(challenge.progress)} /{" "}
        {formatAmount(challenge.targetAmount)}
      </div>
      <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full sm:h-1.5">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
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
      <CardHeader className="flex flex-row items-start justify-between gap-2 p-4 pb-2 sm:p-6 sm:pb-2">
        <CardTitle className="text-muted-foreground min-w-0 truncate text-sm font-medium">
          {title}
        </CardTitle>
        <Icon
          className={cn(
            "h-5 w-5 shrink-0 sm:h-4 sm:w-4",
            className ?? "text-muted-foreground",
          )}
        />
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="font-display text-3xl leading-tight break-words tabular-nums sm:text-2xl">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function LockedStatCard({
  title,
  feature,
}: {
  title: string;
  feature: BooleanFeatureKey;
}) {
  const upgrade = useUpgradeModal();
  return (
    <button
      type="button"
      onClick={() => upgrade.open(feature)}
      className="rounded-lg text-left"
    >
      <Card className="h-full border-dashed">
        <CardHeader className="flex flex-row items-start justify-between gap-2 p-4 pb-2 sm:p-6 sm:pb-2">
          <CardTitle className="text-muted-foreground min-w-0 truncate text-sm font-medium">
            {title}
          </CardTitle>
          <Lock className="text-muted-foreground h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="font-display text-muted-foreground flex items-center gap-2 text-3xl sm:text-2xl">
            —
            <LockBadge />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function FeatureTeaserCard({ feature }: { feature: BooleanFeatureKey }) {
  const t = useTranslations("billing.featureCopy");
  const tShell = useTranslations("billing.teaser");
  const upgrade = useUpgradeModal();
  const bullets = (t.raw(`${feature}.bullets`) as string[] | undefined) ?? [];

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">{t(`${feature}.title`)}</CardTitle>
          <LockBadge />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t(`${feature}.body`)}
        </p>
        {bullets.length > 0 && (
          <ul className="text-foreground/90 space-y-2 text-sm">
            {bullets.slice(0, 3).map((bullet) => (
              <li key={bullet} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="bg-primary mt-2 block h-px w-3 shrink-0"
                />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}
        <Button size="sm" onClick={() => upgrade.open(feature)}>
          {tShell("cta")}
        </Button>
      </CardContent>
    </Card>
  );
}

function AnnualBudgetCard({
  budgets,
  isLoading,
}: {
  budgets: Budget[] | undefined;
  isLoading: boolean;
}) {
  const t = useTranslations("dashboard");
  const currentYear = new Date().getFullYear();
  const totalPlanned = (budgets ?? []).reduce(
    (sum, budget) => sum + budget.totalPlanned,
    0,
  );
  const totalActual = (budgets ?? []).reduce(
    (sum, budget) => sum + budget.totalActual,
    0,
  );
  const remaining = totalPlanned - totalActual;
  const pct =
    totalPlanned > 0
      ? Math.min(
          100,
          Math.round((Math.max(0, totalActual) / totalPlanned) * 100),
        )
      : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-xl sm:text-lg">
            {t("annualBudgets")}
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("currentYearLabel", { year: currentYear })}
          </p>
        </div>
        <Link
          href="/budgets/annual"
          className="text-muted-foreground hover:text-foreground shrink-0 text-base sm:text-sm"
        >
          →
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-2 w-full" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </div>
        ) : (budgets?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <BookOpen className="text-muted-foreground h-6 w-6" />
            <p className="text-muted-foreground text-base sm:text-sm">
              {t("annualBudgetsEmpty")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-base sm:text-sm">
                <span className="text-muted-foreground">
                  {t("spentVsPlanned")}
                </span>
                <span className="text-right font-medium break-words tabular-nums">
                  {formatAmount(totalActual)} / {formatAmount(totalPlanned)}
                </span>
              </div>
              <div className="bg-muted mt-2 h-3 overflow-hidden rounded-full sm:h-2">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    totalActual > totalPlanned ? "bg-expense" : "bg-primary",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 text-base sm:grid-cols-3 sm:text-sm">
              <MetricBox
                label={t("planned")}
                value={formatAmount(totalPlanned)}
              />
              <MetricBox
                label={t("actual")}
                value={formatAmount(totalActual)}
              />
              <MetricBox
                label={t("remaining")}
                value={formatAmount(remaining)}
                tone={remaining < 0 ? "expense" : "income"}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const tProjects = useTranslations("projects");
  const progress = deriveProgress({
    startDate: project.startDate,
    endDate: project.endDate,
    spendingLimit: project.spendingLimit,
    net: project.net,
  });
  const pct =
    progress.limitFraction !== null
      ? Math.min(100, Math.round(progress.limitFraction * 100))
      : 0;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="border-border/70 hover:border-primary/40 hover:bg-accent/50 block rounded-lg border p-3 transition"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden>{project.emoji}</span>
            <p className="truncate text-base font-medium sm:text-sm">
              {project.name}
            </p>
          </div>
          <p className="text-muted-foreground mt-1 text-sm sm:text-xs">
            {tProjects(`status.${statusKey(progress.status)}`)}
          </p>
        </div>
        <span className="shrink-0 text-base font-medium tabular-nums sm:text-sm">
          {formatAmount(project.net)}
        </span>
      </div>
      {project.spendingLimit ? (
        <div className="bg-muted mt-3 h-2.5 overflow-hidden rounded-full sm:h-1.5">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              project.net > project.spendingLimit ? "bg-expense" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </Link>
  );
}

function ProjectsCard({
  projects,
  isLoading,
}: {
  projects: Project[] | undefined;
  isLoading: boolean;
}) {
  const t = useTranslations("dashboard");
  const activeProjects = (projects ?? []).slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle className="text-xl sm:text-lg">{t("projects")}</CardTitle>
        <Link
          href="/projects"
          className="text-muted-foreground hover:text-foreground shrink-0 text-base sm:text-sm"
        >
          →
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : activeProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <FolderHeart className="text-muted-foreground h-6 w-6" />
            <p className="text-muted-foreground text-base sm:text-sm">
              {t("projectsEmpty")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeProjects.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricBox({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "income" | "expense";
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 sm:p-3">
      <p className="text-muted-foreground text-sm sm:text-[11px]">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-lg font-medium tabular-nums sm:text-sm",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function statusKey(status: ReturnType<typeof deriveProgress>["status"]) {
  if (status === "no_dates") return "noDates";
  if (status === "not_started") return "notStarted";
  return status;
}

export function DashboardClient() {
  const t = useTranslations("dashboard");
  const tTx = useTranslations("transactions");
  const locale = useLocale();
  const dateLocale = locale === "da" ? da : enUS;

  const tBudgets = useTranslations("budgets");
  const { has } = useEntitlements();

  const { data: summary } = api.financialAccount.summary.useQuery();
  const { data: assetsSummary } = api.asset.summary.useQuery(undefined, {
    enabled: has("assets"),
  });
  const { data: debtSummary } = api.debt.summary.useQuery(undefined, {
    enabled: has("debts"),
  });
  const { data: weeklyExpense } = api.transaction.weeklyExpense.useQuery();
  const { data: accounts = [] } = api.financialAccount.list.useQuery();
  const { data: recentData, isLoading: recentLoading } =
    api.transaction.list.useQuery({ limit: 5 });
  const recent = recentData?.items;
  const currentYear = new Date().getFullYear();
  const { data: budgets, isLoading: budgetsLoading } = api.budget.list.useQuery(
    {
      year: currentYear,
    },
  );
  const { data: challenges, isLoading: challengesLoading } =
    api.challenge.list.useQuery(undefined, { enabled: has("challenges") });
  const { data: projects, isLoading: projectsLoading } =
    api.project.list.useQuery(
      { includeArchived: false },
      { enabled: has("projects") },
    );
  const activeChallenges = (challenges ?? []).slice(0, 4);

  const netWorth =
    has("netWorth") && summary && assetsSummary && debtSummary
      ? summary.netWorthBalance +
        assetsSummary.total -
        debtSummary.totalOutstanding
      : undefined;

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <PushBanner />

      <div
        data-tour-id="stats"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4"
      >
        <StatCard
          title={t("weeklySpent")}
          value={
            weeklyExpense !== undefined ? formatAmount(weeklyExpense) : "–"
          }
          icon={ArrowLeftRight}
          className="text-expense"
        />
        <StatCard
          title={t("totalBalance")}
          value={
            summary
              ? formatAmount(summary.totalBalance - summary.reservedTotal)
              : "–"
          }
          icon={Wallet}
        />
        {has("debts") ? (
          <StatCard
            title={t("totalDebt")}
            value={
              debtSummary ? formatAmount(debtSummary.totalOutstanding) : "–"
            }
            icon={TrendingDown}
            className="text-debt"
          />
        ) : (
          <LockedStatCard title={t("totalDebt")} feature="debts" />
        )}
        {has("netWorth") ? (
          <StatCard
            title={t("netWorth")}
            value={netWorth !== undefined ? formatAmount(netWorth) : "–"}
            icon={TrendingUp}
            className="text-income"
          />
        ) : (
          <LockedStatCard title={t("netWorth")} feature="netWorth" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <AnnualBudgetCard budgets={budgets} isLoading={budgetsLoading} />

        {has("projects") ? (
          <ProjectsCard projects={projects} isLoading={projectsLoading} />
        ) : (
          <FeatureTeaserCard feature="projects" />
        )}

        <Card data-tour-id="recent-transactions">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <CardTitle className="text-xl sm:text-lg">
              {t("recentTransactions")}
            </CardTitle>
            <Link
              href="/transactions"
              className="text-muted-foreground hover:text-foreground shrink-0 text-base sm:text-sm"
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
                      className="grid w-full min-w-0 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-3 overflow-hidden text-base sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:gap-4 sm:text-sm"
                    >
                      <span className="text-muted-foreground text-base whitespace-nowrap sm:text-sm">
                        {format(dateObj, "d. MMM", { locale: dateLocale })}
                      </span>
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-foreground truncate font-medium">
                          {tx.description}
                        </p>
                        <p className="text-muted-foreground truncate text-base sm:text-xs">
                          {accountMap.get(tx.accountId) ?? "—"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-base font-medium whitespace-nowrap tabular-nums sm:text-sm",
                          tx.type === "expense" && "text-expense",
                          tx.type === "income" && "text-income",
                        )}
                      >
                        {tx.type === "expense" ? "-" : "+"}
                        {formatAmount(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-base sm:text-sm">
                {tTx("emptyState")}
              </p>
            )}
          </CardContent>
        </Card>

        {has("challenges") ? (
          <Card data-tour-id="challenges">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle className="text-xl sm:text-lg">
                {tBudgets("challenges")}
              </CardTitle>
              <Link
                href="/budgets/challenges"
                className="text-muted-foreground hover:text-foreground shrink-0 text-base sm:text-sm"
              >
                →
              </Link>
            </CardHeader>
            <CardContent>
              {challengesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : activeChallenges.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                  <Target className="text-muted-foreground h-6 w-6" />
                  <p className="text-muted-foreground text-base sm:text-sm">
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
        ) : (
          <FeatureTeaserCard feature="challenges" />
        )}
      </div>
    </div>
  );
}
