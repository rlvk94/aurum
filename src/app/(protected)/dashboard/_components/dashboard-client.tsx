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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="bg-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
            <Icon className="text-primary h-3.5 w-3.5" />
          </div>
          <p className="text-foreground truncate text-sm font-medium">
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
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {formatAmount(challenge.progress)} /{" "}
          {formatAmount(challenge.targetAmount)}
        </span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
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
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${className ?? "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="font-display text-xl break-words sm:text-2xl">
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
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            {title}
          </CardTitle>
          <Lock className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="font-display text-muted-foreground flex items-center gap-2 text-xl sm:text-2xl">
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
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">{t("annualBudgets")}</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("currentYearLabel", { year: currentYear })}
          </p>
        </div>
        <Link
          href="/budgets/annual"
          className="text-muted-foreground hover:text-foreground text-sm"
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
            <p className="text-muted-foreground text-sm">
              {t("annualBudgetsEmpty")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("spentVsPlanned")}
                </span>
                <span className="font-medium tabular-nums">
                  {formatAmount(totalActual)} / {formatAmount(totalPlanned)}
                </span>
              </div>
              <div className="bg-muted mt-2 h-2 overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    totalActual > totalPlanned ? "bg-expense" : "bg-primary",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
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
            <p className="truncate text-sm font-medium">{project.name}</p>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {tProjects(`status.${statusKey(progress.status)}`)}
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {formatAmount(project.net)}
        </span>
      </div>
      {project.spendingLimit ? (
        <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{t("projects")}</CardTitle>
        <Link
          href="/projects"
          className="text-muted-foreground hover:text-foreground text-sm"
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
            <p className="text-muted-foreground text-sm">
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
    <div className="bg-muted/50 rounded-lg p-3">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-sm font-medium tabular-nums",
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

      <div
        data-tour-id="stats"
        className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4"
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
          value={summary ? formatAmount(summary.totalBalance) : "–"}
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

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <AnnualBudgetCard budgets={budgets} isLoading={budgetsLoading} />

        {has("projects") ? (
          <ProjectsCard projects={projects} isLoading={projectsLoading} />
        ) : (
          <FeatureTeaserCard feature="projects" />
        )}

        <Card data-tour-id="recent-transactions">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{t("recentTransactions")}</CardTitle>
            <Link
              href="/transactions"
              className="text-muted-foreground hover:text-foreground text-sm"
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
                      <span className="text-muted-foreground w-20 whitespace-nowrap">
                        {format(dateObj, "d. MMM", { locale: dateLocale })}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate font-medium">
                          {tx.description}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {accountMap.get(tx.accountId) ?? "—"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "font-medium whitespace-nowrap",
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
              <p className="text-muted-foreground text-sm">
                {tTx("emptyState")}
              </p>
            )}
          </CardContent>
        </Card>

        {has("challenges") ? (
          <Card data-tour-id="challenges">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">
                {tBudgets("challenges")}
              </CardTitle>
              <Link
                href="/budgets/challenges"
                className="text-muted-foreground hover:text-foreground text-sm"
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
                  <p className="text-muted-foreground text-sm">
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
