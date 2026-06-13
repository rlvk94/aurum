"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import posthog from "posthog-js";
import {
  Archive,
  CalendarRange,
  CircleDollarSign,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/app/_components/badge";
import { Button } from "~/app/_components/button";
import { Card, CardContent, CardHeader } from "~/app/_components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import { Skeleton } from "~/app/_components/skeleton";
import { usePageMetadata } from "~/app/_components/page-metadata";
import { ChallengeFormDialog } from "../../_components/challenge-form-dialog";
import { TransactionCategoryDialog } from "../../../../transactions/_components/transaction-category-dialog";
import {
  computeOnTrack,
  daysBetween,
  formatAmount,
  formatPeriodRange,
  pickAmountLabelKey,
  pickProgressColor,
} from "../../_lib/challenge-progress";
import { ChallengePeriodRow, PeriodTransactions } from "./challenge-period-row";

export type QuickAssignTx = { id: string; categoryId: string | null };

type ChallengeDetail = RouterOutputs["challenge"]["get"];

const typeIcon = {
  spend_less: TrendingDown,
  savings: PiggyBank,
  pay_off_loan: CircleDollarSign,
  net_worth_goal: TrendingUp,
} as const;

export function ChallengeDetailClient({ id }: { id: string }) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const utils = api.useUtils();

  const { data: challenge, isLoading } = api.challenge.get.useQuery({ id });
  const { data: categories } = api.category.list.useQuery();

  usePageMetadata(
    challenge
      ? { title: challenge.name, parentPath: "/budgets/challenges" }
      : null,
  );

  useEffect(() => {
    if (!challenge) return;
    posthog.capture("challenge_detail_viewed", {
      repetition: challenge.repetition,
      type: challenge.type,
    });
  }, [challenge]);

  const [editing, setEditing] = useState(false);
  const [quickAssign, setQuickAssign] = useState<QuickAssignTx | null>(null);

  const invalidate = () => {
    void utils.challenge.get.invalidate({ id });
    void utils.challenge.list.invalidate();
  };

  const setArchived = api.challenge.setArchived.useMutation({
    onSuccess: (_, variables) => {
      posthog.capture("challenge_archived", { archived: variables.archived });
      invalidate();
    },
  });
  const deleteChallenge = api.challenge.delete.useMutation({
    onSuccess: () => {
      void utils.challenge.list.invalidate();
      router.push("/budgets/challenges");
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-48 w-full rounded-[18px]" />
        <Skeleton className="h-64 w-full rounded-[14px]" />
      </div>
    );
  }

  if (!challenge) return null;

  const Icon = typeIcon[challenge.type];
  const archived = Boolean(challenge.archivedAt);
  const pastInstances = challenge.instances.filter(
    (i) => i.status !== "active" && i.id !== challenge.currentInstance?.id,
  );

  const handleDelete = () => {
    if (confirm(t("challengeDeleteConfirm", { name: challenge.name }))) {
      deleteChallenge.mutate({ id: challenge.id });
    }
  };

  const hasHistory =
    challenge.repetition !== "one_off" && pastInstances.length > 0;

  const cats = categories ?? [];

  const historySection = hasHistory ? (
    <div className="space-y-2">
      {pastInstances.map((inst) => (
        <ChallengePeriodRow
          key={inst.id}
          instance={inst}
          challenge={challenge}
          locale={locale}
          categories={cats}
          onAssignCategory={setQuickAssign}
        />
      ))}
    </div>
  ) : null;

  const currentSection = challenge.currentInstance ? (
    <CurrentPeriodCard
      challenge={challenge}
      locale={locale}
      categories={cats}
      onAssignCategory={setQuickAssign}
    />
  ) : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-row items-start justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="bg-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-12 sm:w-12">
            <Icon className="text-primary h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-foreground truncate text-2xl sm:text-3xl">
              {challenge.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {t(`challengeTypes.${challenge.type}`)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {t(`challengeRepetitions.${challenge.repetition}`)}
              </Badge>
              {archived && (
                <Badge variant="outline" className="text-[10px]">
                  {t("challengeStatuses.archived")}
                </Badge>
              )}
            </div>
            {challenge.description && (
              <p className="text-muted-foreground mt-3 max-w-xl text-sm">
                {challenge.description}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil />
                {tCommon("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setArchived.mutate({ id: challenge.id, archived: !archived })
                }
              >
                <Archive />
                {archived ? t("challengeUnarchive") : t("challengeArchive")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={handleDelete}
              >
                <Trash2 />
                {t("challengeDelete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasHistory ? (
        <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          <div className="min-w-0 lg:col-span-1">{currentSection}</div>
          <div className="min-w-0 lg:col-span-2">{historySection}</div>
        </div>
      ) : (
        currentSection
      )}

      <ChallengeFormDialog
        key={editing ? challenge.id : "closed"}
        open={editing}
        onOpenChange={(open) => setEditing(open)}
        challenge={challenge}
      />

      <TransactionCategoryDialog
        transactionId={quickAssign?.id ?? null}
        currentCategoryId={quickAssign?.categoryId ?? null}
        open={Boolean(quickAssign)}
        onOpenChange={(open) => !open && setQuickAssign(null)}
      />
    </div>
  );
}

function CurrentPeriodCard({
  challenge,
  locale,
  categories,
  onAssignCategory,
}: {
  challenge: ChallengeDetail;
  locale: string;
  categories: RouterOutputs["category"]["list"];
  onAssignCategory: (tx: QuickAssignTx) => void;
}) {
  const t = useTranslations("budgets");
  const { currentInstance, progress, targetAmount } = challenge;
  if (!currentInstance) return null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const notStarted = currentInstance.periodStart > todayIso;
  const ended = currentInstance.periodEnd < todayIso;
  const daysLeft = Math.max(
    0,
    daysBetween(todayIso, currentInstance.periodEnd),
  );
  const daysToStart = Math.max(
    0,
    daysBetween(todayIso, currentInstance.periodStart),
  );

  const isSpendLess = challenge.type === "spend_less";
  const ratio = targetAmount > 0 ? Math.max(0, progress) / targetAmount : 0;
  const displayPct = Math.min(100, Math.round(ratio * 100));
  const remaining = targetAmount - progress;
  const isOver = isSpendLess ? progress > targetAmount : false;

  const onTrack = computeOnTrack({
    type: challenge.type,
    ratio,
    periodStartIso: currentInstance.periodStart,
    periodEndIso: currentInstance.periodEnd,
    todayIso,
  });

  const progressColor = pickProgressColor(
    challenge.type,
    ratio,
    targetAmount,
    progress,
    onTrack,
  );
  const amountLabel = t(pickAmountLabelKey(challenge.type));
  const periodLabel = formatPeriodRange(
    currentInstance.periodStart,
    currentInstance.periodEnd,
    locale,
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            {t("challengeCurrentPeriod")}
          </p>
          <p className="text-foreground mt-1 flex items-center gap-1.5 text-sm">
            <CalendarRange className="text-muted-foreground h-4 w-4" />
            {periodLabel}
          </p>
        </div>
        {notStarted && (
          <Badge variant="outline">{t("challengeNotStarted")}</Badge>
        )}
        {ended && !notStarted && (
          <Badge variant="outline">{t("challengeEnded")}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-muted-foreground text-xs">{amountLabel}</p>
          <p className="font-display text-foreground text-3xl">
            {formatAmount(progress)}
            <span className="text-muted-foreground ml-1.5 text-base">
              / {formatAmount(targetAmount)}
            </span>
          </p>
        </div>

        <div>
          <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
            <span>{t("challengeProgress")}</span>
            <span>{displayPct}%</span>
          </div>
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full transition-all ${progressColor}`}
              style={{ width: `${displayPct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-1 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">
              {isOver
                ? t("challengeOverBy", { amount: formatAmount(-remaining) })
                : t("challengeRemaining")}
            </p>
            {!isOver && (
              <p className="text-foreground mt-0.5 font-medium">
                {formatAmount(Math.max(0, remaining))}
              </p>
            )}
          </div>
          <div>
            <p className="text-muted-foreground text-xs">
              {notStarted
                ? daysToStart === 0
                  ? t("challengeStartsToday")
                  : t("challengeStartsIn", { count: daysToStart })
                : ended
                  ? t("challengeEnded")
                  : t("daysLeft", { count: daysLeft })}
            </p>
            {onTrack !== null && (
              <p
                className={`mt-0.5 font-medium ${onTrack ? "text-income" : "text-warning"}`}
              >
                {onTrack ? t("challengeOnTrack") : t("challengeOffTrack")}
              </p>
            )}
          </div>
        </div>

        <div className="border-border border-t pt-3">
          <PeriodTransactions
            instance={currentInstance}
            challenge={challenge}
            locale={locale}
            categories={categories}
            onAssignCategory={onAssignCategory}
          />
        </div>
      </CardContent>
    </Card>
  );
}
