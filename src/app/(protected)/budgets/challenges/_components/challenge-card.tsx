"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Archive,
  CalendarRange,
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
import {
  computeOnTrack,
  daysBetween,
  formatAmount,
  formatPeriodRange,
  pickAmountLabelKey,
  pickProgressColor,
} from "../_lib/challenge-progress";

type Challenge = RouterOutputs["challenge"]["list"][number];

const typeIcon = {
  spend_less: TrendingDown,
  savings: PiggyBank,
  pay_off_loan: CircleDollarSign,
  net_worth_goal: TrendingUp,
} as const;

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
  const locale = useLocale();

  const { currentInstance, progress, targetAmount } = challenge;
  const archived = Boolean(challenge.archivedAt);

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
  const ratio = targetAmount > 0 ? Math.max(0, progress) / targetAmount : 0;
  const displayPct = Math.min(100, Math.round(ratio * 100));
  const remaining = targetAmount - progress;
  const isOver = isSpendLess ? progress > targetAmount : false;

  const onTrack = currentInstance
    ? computeOnTrack({
        type: challenge.type,
        ratio,
        periodStartIso: currentInstance.periodStart,
        periodEndIso: currentInstance.periodEnd,
        todayIso,
      })
    : null;

  const progressColor = pickProgressColor(
    challenge.type,
    ratio,
    targetAmount,
    progress,
    onTrack,
  );

  const amountLabel = t(pickAmountLabelKey(challenge.type));
  const periodLabel = currentInstance
    ? formatPeriodRange(
        currentInstance.periodStart,
        currentInstance.periodEnd,
        locale,
      )
    : null;

  const stopProp = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <Link
      href={`/budgets/challenges/${challenge.id}`}
      aria-label={t("challengeViewDetails", { name: challenge.name })}
      className="group focus-visible:ring-ring block rounded-xl outline-none focus-visible:ring-2"
    >
      <Card
        className={`${archived ? "opacity-60" : ""} group-hover:shadow-elevated transition-shadow`}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="bg-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Icon className="text-primary h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-foreground truncate font-medium">
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
            <div onClick={stopProp} onPointerDown={stopProp}>
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
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-muted-foreground text-xs">{amountLabel}</p>
            <p className="font-display text-foreground text-2xl">
              {formatAmount(progress)}
              <span className="text-muted-foreground ml-1 text-sm">
                / {formatAmount(targetAmount)}
              </span>
            </p>
          </div>

          {periodLabel && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <CalendarRange className="h-3.5 w-3.5" />
              <span>{periodLabel}</span>
            </p>
          )}

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

          <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
            <div>
              <p className="text-muted-foreground">
                {isOver
                  ? t("challengeOverBy", { amount: formatAmount(-remaining) })
                  : t("challengeRemaining")}
              </p>
              {!isOver && (
                <p className="text-foreground font-medium">
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
                <p
                  className={`font-medium ${onTrack ? "text-income" : "text-warning"}`}
                >
                  {onTrack ? t("challengeOnTrack") : t("challengeOffTrack")}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
