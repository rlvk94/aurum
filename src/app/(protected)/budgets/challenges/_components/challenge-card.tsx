"use client";

import { useTranslations } from "next-intl";
import {
  Archive,
  CircleDollarSign,
  MoreHorizontal,
  PiggyBank,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Badge } from "~/app/_components/badge";
import { Card, CardContent, CardHeader } from "~/app/_components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";

type Challenge = RouterOutputs["challenge"]["list"][number];

function formatAmount(cents: number): string {
  const value = Math.abs(cents) / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  return `${cents < 0 ? "-" : ""}${formatted} kr.`;
}

const typeIcon = {
  spend_less: TrendingDown,
  savings: PiggyBank,
  pay_off_loan: CircleDollarSign,
  net_worth_goal: TrendingUp,
} as const;

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`);
  const b = new Date(`${toIso}T00:00:00Z`);
  return Math.round((+b - +a) / 86_400_000);
}

export function ChallengeCard({
  challenge,
  onEdit,
  onArchiveToggle,
  onDelete,
}: {
  challenge: Challenge;
  onEdit: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");

  const { currentInstance, progress, targetAmount } = challenge;
  const archived = !!challenge.archivedAt;

  const Icon = typeIcon[challenge.type];

  const todayIso = new Date().toISOString().slice(0, 10);
  const notStarted = currentInstance
    ? currentInstance.periodStart > todayIso
    : false;
  const ended = currentInstance ? currentInstance.periodEnd < todayIso : false;
  const daysLeft = currentInstance
    ? Math.max(0, daysBetween(todayIso, currentInstance.periodEnd))
    : 0;
  const daysToStart = currentInstance
    ? Math.max(0, daysBetween(todayIso, currentInstance.periodStart))
    : 0;

  const isSpendLess = challenge.type === "spend_less";
  // spend-less: lower progress is better; others: higher is better.
  const ratio =
    targetAmount > 0 ? Math.max(0, progress) / targetAmount : 0;
  const displayPct = Math.min(100, Math.round(ratio * 100));
  const remaining = isSpendLess
    ? targetAmount - progress
    : targetAmount - progress;
  const isOver = isSpendLess ? progress > targetAmount : false;
  const met = isSpendLess
    ? progress <= targetAmount
    : progress >= targetAmount;

  // On-track: for spend-less, elapsed-fraction >= spent-fraction means on pace.
  // For accrual types (savings/pay_off), saved-fraction >= elapsed-fraction means on pace.
  // Skip on-track while not yet started or after the period ended.
  let onTrack: boolean | null = null;
  if (currentInstance && !notStarted && !ended) {
    const totalDays = Math.max(
      1,
      daysBetween(currentInstance.periodStart, currentInstance.periodEnd) + 1,
    );
    const elapsed = Math.max(
      0,
      Math.min(
        totalDays,
        daysBetween(currentInstance.periodStart, todayIso) + 1,
      ),
    );
    const elapsedFrac = elapsed / totalDays;
    if (isSpendLess) {
      onTrack = ratio <= elapsedFrac + 0.01;
    } else {
      onTrack = ratio >= elapsedFrac - 0.01;
    }
  }

  const progressColor = isSpendLess
    ? isOver
      ? "bg-expense"
      : onTrack
        ? "bg-primary"
        : "bg-warning"
    : met
      ? "bg-income"
      : onTrack
        ? "bg-primary"
        : "bg-warning";

  const amountLabel = isSpendLess
    ? t("challengeSpent")
    : challenge.type === "savings"
      ? t("challengeSaved")
      : challenge.type === "net_worth_goal"
        ? t("challengeNetWorth")
        : t("challengePaid");

  return (
    <Card className={archived ? "opacity-60" : ""}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {challenge.name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {t(`challengeTypes.${challenge.type}`)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {t(`challengeRepetitions.${challenge.repetition}`)}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {notStarted && (
            <Badge variant="outline">{t("challengeNotStarted")}</Badge>
          )}
          {ended && !notStarted && (
            <Badge variant="outline">{t("challengeEnded")}</Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil />
                {tCommon("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchiveToggle}>
                <Archive />
                {archived ? t("challengeUnarchive") : t("challengeArchive")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={onDelete}
              >
                <Trash2 />
                {t("challengeDelete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">{amountLabel}</p>
          <p className="font-display text-2xl text-foreground">
            {formatAmount(progress)}
            <span className="ml-1 text-sm text-muted-foreground">
              / {formatAmount(targetAmount)}
            </span>
          </p>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("challengeProgress")}</span>
            <span>{displayPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${progressColor}`}
              style={{ width: `${displayPct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
          <div>
            <p className="text-muted-foreground">
              {isOver
                ? t("challengeOverBy", { amount: formatAmount(-remaining) })
                : t("challengeRemaining")}
            </p>
            {!isOver && (
              <p className="font-medium text-foreground">
                {formatAmount(Math.max(0, remaining))}
              </p>
            )}
          </div>
          <div>
            <p className="text-muted-foreground">
              {notStarted
                ? daysToStart === 0
                  ? t("challengeStartsToday")
                  : t("challengeStartsIn", { count: daysToStart })
                : ended
                  ? t("challengeEnded")
                  : t("daysLeft", { count: daysLeft })}
            </p>
            {onTrack !== null && (
              <p className={`font-medium ${onTrack ? "text-income" : "text-warning"}`}>
                {onTrack ? t("challengeOnTrack") : t("challengeOffTrack")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
