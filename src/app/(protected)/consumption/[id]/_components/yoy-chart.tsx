"use client";

import { useTranslations } from "next-intl";

import {
  parseMonthsLong,
  parseMonthsShort,
} from "~/app/(protected)/budgets/annual/_lib/budget-format";
import { cn } from "~/app/_lib/utils";
import type { MonthBucket } from "~/server/lib/consumption";
import { formatQuantity, monthCellState } from "../../_lib/format";

// Grouped two-series bar chart: previous year (pale) next to the selected year
// (gold), one pair per month. Forked from accounts/[id] MonthlyChart. Partially
// covered months render dashed at reduced opacity so they never read as full.
export function YoyChart({
  current,
  previous,
  year,
  decimals,
  unit,
  currentMonthIndex,
}: {
  current: MonthBucket[];
  previous?: MonthBucket[];
  year: number;
  decimals: number;
  unit: string;
  currentMonthIndex: number | null;
}) {
  const t = useTranslations("consumption");
  const tBudgets = useTranslations("budgets");
  const monthsShort = parseMonthsShort(tBudgets("monthsShort"));
  const monthsLong = parseMonthsLong(tBudgets("monthsLong"));

  const values = [...current, ...(previous ?? [])]
    .map((b) => b.consumption ?? 0)
    .filter((v) => v > 0);
  const max = Math.max(1, ...values);
  const hasAny = values.length > 0;

  if (!hasAny) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        {t("chart.empty")}
      </p>
    );
  }

  const fmt = (v: number) => formatQuantity(v, decimals, unit);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1.5 sm:gap-3" style={{ height: 180 }}>
        {current.map((cur, i) => {
          const prev = previous?.[i];
          const curState = monthCellState(cur);
          const prevState = prev ? monthCellState(prev) : "none";
          const curH = cur.consumption ? (cur.consumption / max) * 160 : 0;
          const prevH = prev?.consumption ? (prev.consumption / max) * 160 : 0;
          const hasData = curState !== "none" || prevState !== "none";
          return (
            <div
              key={i}
              className="group relative flex flex-1 flex-col items-center justify-end"
              style={{ height: 160 }}
            >
              <div className="flex h-full w-full items-end justify-center gap-0.5">
                <Bar height={prevH} state={prevState} tone="previous" />
                <Bar height={curH} state={curState} tone="current" />
              </div>
              {hasData && (
                <div className="border-border bg-popover shadow-elevated pointer-events-none absolute bottom-full z-10 mb-2 hidden rounded-md border px-2 py-1 text-xs whitespace-nowrap group-hover:block">
                  <p className="font-medium">{monthsLong[i]}</p>
                  <p className="tabular-nums">
                    {year}:{" "}
                    {curState === "none"
                      ? t("chart.noData")
                      : fmt(cur.consumption ?? 0)}
                    {curState === "partial" &&
                      ` ${t("chart.partialSuffix", { covered: cur.coveredDays, days: cur.daysInMonth })}`}
                  </p>
                  {previous && prev && (
                    <p className="text-muted-foreground tabular-nums">
                      {year - 1}:{" "}
                      {prevState === "none"
                        ? t("chart.noData")
                        : fmt(prev.consumption ?? 0)}
                      {prevState === "partial" &&
                        ` ${t("chart.partialSuffix", { covered: prev.coveredDays, days: prev.daysInMonth })}`}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-end gap-1.5 sm:gap-3">
        {monthsShort.map((label, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 text-center text-xs",
              currentMonthIndex === i
                ? "text-primary font-medium"
                : "text-muted-foreground",
            )}
          >
            <span className="sm:hidden">{label.charAt(0)}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-4 pt-2 text-xs">
        {previous && (
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-primary/30 h-2 w-2 rounded-sm" />
            {year - 1}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-primary h-2 w-2 rounded-sm" />
          {year}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="border-primary/70 bg-primary/25 h-2 w-2 rounded-sm border border-dashed" />
          {t("chart.partialLegend")}
        </span>
      </div>
    </div>
  );
}

function Bar({
  height,
  state,
  tone,
}: {
  height: number;
  state: "none" | "partial" | "complete";
  tone: "previous" | "current";
}) {
  if (state === "none") return <div className="w-1/2" />;
  return (
    <div
      aria-hidden
      className={cn(
        "w-1/2 rounded-sm transition-all",
        tone === "current" ? "bg-primary" : "bg-primary/30",
        state === "partial" &&
          "border-primary/70 border border-dashed opacity-60",
      )}
      style={{ height: `${Math.max(height, 2)}px` }}
    />
  );
}
