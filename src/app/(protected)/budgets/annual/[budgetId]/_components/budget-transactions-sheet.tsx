"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { format, parse } from "date-fns";
import { da, enUS } from "date-fns/locale";
import { EyeOff, Link2 } from "lucide-react";

import { api } from "~/trpc/react";
import { cn } from "~/app/_lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/app/_components/sheet";
import { Button } from "~/app/_components/button";
import { Skeleton } from "~/app/_components/skeleton";
import { formatMoney } from "~/app/(protected)/income-planner/_lib/format";
import {
  cellState,
  fillClass,
  parseMonthsLong,
  trackClass,
  varianceTextClass,
} from "../../_lib/budget-format";

export type DrillDownTarget = {
  // Stable identity so consumers can compare and we can use as key.
  key: string;
  label: string;
  icon: string | null;
  // Empty array + includeUncategorized=true means "orphan / no category".
  categoryIds: string[];
  includeUncategorized?: boolean;
  // null → full year range.
  monthIndex: number | null;
  year: number;
  accountIds: string[];
  planned: number;
  actual: number;
};

function monthRange(year: number, monthIndex: number | null) {
  if (monthIndex === null) {
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  const mm = String(monthIndex + 1).padStart(2, "0");
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function BudgetTransactionsSheet({
  target,
  open,
  onOpenChange,
}: {
  target: DrillDownTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("budgets");
  const locale = useLocale();
  const dateLocale = locale === "da" ? da : enUS;

  const monthsLong = useMemo(
    () => parseMonthsLong(t("monthsLong")),
    [t],
  );

  const { from, to } = useMemo(
    () =>
      target
        ? monthRange(target.year, target.monthIndex)
        : { from: "", to: "" },
    [target],
  );

  const enabled =
    open &&
    target !== null &&
    (target.categoryIds.length > 0 || target.includeUncategorized === true);

  const query = api.transaction.list.useInfiniteQuery(
    {
      categoryIds: target?.categoryIds.length ? target.categoryIds : undefined,
      includeUncategorized: target?.includeUncategorized,
      accountIds:
        target && target.accountIds.length > 0 ? target.accountIds : undefined,
      from,
      to,
      type: "expense",
      limit: 50,
    },
    {
      enabled,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      initialCursor: null,
    },
  );

  const items = useMemo(
    () => (query.data ? query.data.pages.flatMap((p) => p.items) : []),
    [query.data],
  );

  const subtitle = target
    ? target.monthIndex === null
      ? t("drillDownSubtitleYear")
      : t("drillDownSubtitleMonth", {
          month: monthsLong[target.monthIndex] ?? "",
        })
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] [&>button]:top-[calc(env(safe-area-inset-top,0px)+1rem)] sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            {target?.icon && (
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-lg leading-none"
              >
                {target.icon}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <SheetTitle className="font-display text-xl truncate">
                {target ? target.label : t("drillDownTitle")}
              </SheetTitle>
              <SheetDescription className="truncate text-sm">
                {subtitle}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {target && <SummaryHeader target={target} />}

        <div className="flex-1 overflow-y-auto">
          {!enabled && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("drillDownEmpty")}
            </p>
          )}

          {enabled && query.isLoading && (
            <div className="space-y-2 p-4">
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          )}

          {enabled && !query.isLoading && items.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("drillDownEmpty")}
            </p>
          )}

          {enabled && items.length > 0 && (
            <ul className="divide-y divide-border">
              {items.map((tx) => {
                const dateObj = parse(tx.date, "yyyy-MM-dd", new Date());
                const sign = tx.type === "expense" ? -1 : 1;
                return (
                  <li
                    key={tx.id}
                    className={cn(
                      "flex items-center gap-3 px-5 py-3",
                      tx.excludedFromCalculations && "opacity-60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {tx.transferGroupId && (
                          <Link2
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                        )}
                        <p className="truncate text-sm font-medium text-foreground">
                          {tx.description}
                        </p>
                        {tx.excludedFromCalculations && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                            <EyeOff className="h-2.5 w-2.5" aria-hidden />
                            {t("drillDownExcluded")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(dateObj, "d. MMM yyyy", { locale: dateLocale })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "almanac-numerals shrink-0 text-sm tabular-nums",
                        tx.type === "expense"
                          ? "text-expense"
                          : "text-income",
                      )}
                    >
                      {sign < 0 ? "−" : "+"}
                      {formatMoney(tx.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {query.hasNextPage && (
            <div className="px-5 py-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {t("drillDownLoadMore")}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SummaryHeader({ target }: { target: DrillDownTarget }) {
  const t = useTranslations("budgets");
  const { planned, actual } = target;
  const state = cellState(planned, actual);
  const ratio = planned > 0 ? actual / planned : actual > 0 ? 1 : 0;
  const fillPct = Math.min(100, Math.max(0, ratio * 100));
  const overshootPct =
    planned > 0 && actual > planned
      ? Math.min(40, ((actual - planned) / planned) * 100)
      : 0;
  const variance = actual - planned;
  const pctOfPlan =
    planned > 0 ? Math.round((actual / planned) * 100) : null;
  const varianceLabel =
    variance > 0 ? t("overBy") : variance < 0 ? t("remaining") : t("onBudget");
  const varianceColor = varianceTextClass(planned, actual);

  return (
    <div className="border-b border-border px-5 py-4">
      <dl className="grid grid-cols-3 gap-3">
        <Metric label={t("cellPlanned")} value={formatMoney(planned)} />
        <Metric
          label={t("cellActual")}
          value={actual > 0 ? formatMoney(actual) : "—"}
          valueClass={actual > 0 ? varianceColor : undefined}
        />
        <Metric
          label={varianceLabel}
          value={
            planned === 0 && actual === 0
              ? "—"
              : formatMoney(Math.abs(variance))
          }
          valueClass={varianceColor}
        />
      </dl>

      {(planned > 0 || actual > 0) && (
        <div className="mt-3 space-y-1.5">
          <div
            className={cn(
              "relative h-2.5 overflow-hidden rounded-full",
              trackClass(state),
            )}
          >
            {fillPct > 0 && (
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  fillClass(state),
                )}
                style={{ width: `${fillPct}%` }}
              />
            )}
            {overshootPct > 0 && (
              <div
                className="absolute inset-y-0 right-0 bg-expense/80"
                style={{ width: `${overshootPct}%` }}
              />
            )}
          </div>
          {pctOfPlan !== null && (
            <div className="flex items-center justify-between almanac-smallcaps text-[10px]">
              <span className="text-muted-foreground">{t("pace")}</span>
              <span className={varianceColor}>
                {t("usedPct", { pct: String(pctOfPlan) })}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="almanac-smallcaps text-[10px] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "almanac-numerals mt-1 truncate font-display text-base leading-tight",
          valueClass ?? "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
