"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { da, enUS } from "date-fns/locale";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/app/_components/badge";
import { Skeleton } from "~/app/_components/skeleton";
import {
  formatAmount,
  formatPeriodRange,
} from "../../_lib/challenge-progress";

type ChallengeDetail = RouterOutputs["challenge"]["get"];
type ChallengeInstance = ChallengeDetail["instances"][number];
type Category = RouterOutputs["category"]["list"][number];

export function ChallengePeriodRow({
  instance,
  challenge,
  locale,
  categories,
}: {
  instance: ChallengeInstance;
  challenge: ChallengeDetail;
  locale: string;
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);

  const finalAmount = instance.finalAmount ?? 0;
  const target = challenge.targetAmount;

  const isSpendLess = challenge.type === "spend_less";
  // Goal met: spend_less wants finalAmount <= target; accrual types want finalAmount >= target.
  const met = isSpendLess
    ? finalAmount <= target
    : finalAmount >= target;
  const ratio = target > 0 ? Math.max(0, finalAmount) / target : 0;
  const displayPct = Math.min(100, Math.round(ratio * 100));
  const barColor = met ? "bg-income" : "bg-expense";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        aria-expanded={open}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {formatPeriodRange(instance.periodStart, instance.periodEnd, locale)}
          </span>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatAmount(finalAmount)}
              <span className="ml-1 text-xs text-muted-foreground/70">
                / {formatAmount(target)}
              </span>
            </span>
            {open ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${displayPct}%` }}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          <PeriodTransactions
            instance={instance}
            challenge={challenge}
            locale={locale}
            categories={categories}
          />
        </div>
      )}
    </div>
  );
}

export function PeriodTransactions({
  instance,
  challenge,
  locale,
  categories,
}: {
  instance: ChallengeInstance;
  challenge: ChallengeDetail;
  locale: string;
  categories: Category[];
}) {
  const t = useTranslations("budgets");
  const dateLocale = locale.startsWith("da") ? da : enUS;

  if (challenge.type === "net_worth_goal") {
    return (
      <p className="text-sm text-muted-foreground">
        {t("challengeNoTransactionsForType")}
      </p>
    );
  }

  const useExpense =
    challenge.type === "spend_less" || challenge.type === "pay_off_loan";

  const accountIdsForSavings =
    challenge.type === "savings" && challenge.accountId
      ? [challenge.accountId]
      : undefined;

  const accountIdsForExpense =
    challenge.accountIds.length > 0 ? challenge.accountIds : undefined;

  const query = api.transaction.list.useQuery(
    useExpense
      ? {
          categoryIds: challenge.categoryIds,
          accountIds: accountIdsForExpense,
          type: "expense" as const,
          from: instance.periodStart,
          to: instance.periodEnd,
          limit: 200,
        }
      : {
          accountIds: accountIdsForSavings,
          from: instance.periodStart,
          to: instance.periodEnd,
          limit: 200,
        },
    {
      enabled:
        challenge.type === "savings"
          ? Boolean(accountIdsForSavings)
          : challenge.categoryIds.length > 0,
    },
  );

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
      </div>
    );
  }

  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("challengeNoTransactionsInPeriod")}
      </p>
    );
  }

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <ul className="divide-y divide-border">
      {items.map((tx) => {
        const dateLabel = format(parseISO(tx.date), "d. MMM yyyy", {
          locale: dateLocale,
        });
        const isExpense = tx.type === "expense";
        const signed = isExpense ? -tx.amount : tx.amount;
        const amountClass = isExpense
          ? "text-expense"
          : tx.type === "income"
            ? "text-income"
            : "text-foreground";
        const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null;
        return (
          <li
            key={tx.id}
            className="flex items-center gap-3 py-2 text-sm"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-foreground">{tx.description}</span>
              <span className="text-xs text-muted-foreground">{dateLabel}</span>
            </div>
            {cat && (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 text-[10px] font-normal"
              >
                {cat.icon && (
                  <span className="leading-none">{cat.icon}</span>
                )}
                <span>{cat.name}</span>
              </Badge>
            )}
            <span
              className={`ml-auto shrink-0 font-medium tabular-nums ${amountClass}`}
            >
              {formatAmount(signed)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
