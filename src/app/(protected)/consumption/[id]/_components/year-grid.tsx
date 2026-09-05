"use client";

import { useTranslations } from "next-intl";

import { parseMonthsShort } from "~/app/(protected)/budgets/annual/_lib/budget-format";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/app/_components/tooltip";
import { cn } from "~/app/_lib/utils";
import type { MonthBucket, YearSummary } from "~/server/lib/consumption";
import { formatQuantity, monthCellState } from "../../_lib/format";

// Rows = years (newest first), columns = the twelve months, plus a total. Cells
// are derived consumption and therefore read-only; readings are edited in the
// table below. Partial months are muted/italic with a coverage tooltip.
export function YearGrid({
  months,
  years,
  decimals,
  unit,
  currentYear,
  currentMonthIndex,
}: {
  months: Record<number, MonthBucket[]>;
  years: YearSummary[];
  decimals: number;
  unit: string;
  currentYear: number;
  currentMonthIndex: number | null;
}) {
  const t = useTranslations("consumption");
  const tBudgets = useTranslations("budgets");
  const monthsShort = parseMonthsShort(tBudgets("monthsShort"));

  const yearKeys = Object.keys(months)
    .map(Number)
    .sort((a, b) => b - a);
  const summaryByYear = new Map(years.map((y) => [y.year, y]));
  const hasAny = yearKeys.some((y) =>
    months[y]!.some((b) => b.consumption !== null),
  );

  if (yearKeys.length === 0 || !hasAny) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        {t("grid.empty")}
      </p>
    );
  }

  const fmt = (v: number) => formatQuantity(v, decimals, "");

  return (
    <div className="border-border relative overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <colgroup>
            <col className="w-16" />
            {monthsShort.map((m) => (
              <col key={m} className="w-[88px]" />
            ))}
            <col className="w-[120px]" />
          </colgroup>
          <thead>
            <tr className="border-border border-b">
              <th
                scope="col"
                className="bg-card text-muted-foreground sticky left-0 z-10 px-3 py-2 text-left text-xs font-medium"
              >
                {t("grid.year")}
              </th>
              {monthsShort.map((label, i) => (
                <th
                  key={label}
                  scope="col"
                  className={cn(
                    "text-muted-foreground px-2 py-2 text-right text-xs font-medium",
                    currentMonthIndex === i && "bg-primary/[0.04] text-primary",
                  )}
                >
                  {label}
                </th>
              ))}
              <th
                scope="col"
                className="text-muted-foreground px-3 py-2 text-right text-xs font-medium"
              >
                {t("grid.total")} {unit ? `(${unit})` : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {yearKeys.map((year) => {
              const summary = summaryByYear.get(year);
              const isCurrentYear = year === currentYear;
              return (
                <tr
                  key={year}
                  className="border-border/60 border-b last:border-0"
                >
                  <th
                    scope="row"
                    className="bg-card font-display sticky left-0 z-10 px-3 py-2 text-left text-base font-normal tabular-nums"
                  >
                    {year}
                  </th>
                  {months[year]!.map((cell, i) => {
                    const state = monthCellState(cell);
                    const isNow = isCurrentYear && currentMonthIndex === i;
                    return (
                      <td
                        key={i}
                        className={cn(
                          "px-2 py-2 text-right whitespace-nowrap tabular-nums",
                          isNow && "bg-primary/[0.04]",
                        )}
                      >
                        {state === "none" ? (
                          <span className="text-muted-foreground/50">—</span>
                        ) : state === "partial" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="text-muted-foreground cursor-help italic"
                                aria-label={t("grid.partialTooltip", {
                                  covered: cell.coveredDays,
                                  days: cell.daysInMonth,
                                })}
                              >
                                {fmt(cell.consumption ?? 0)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {t("grid.partialTooltip", {
                                covered: cell.coveredDays,
                                days: cell.daysInMonth,
                              })}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span>{fmt(cell.consumption ?? 0)}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                    <span className="font-medium">
                      {fmt(summary?.total ?? 0)}
                    </span>
                    <span className="text-muted-foreground block text-[10px] leading-tight">
                      {t("grid.completeMonths", {
                        count: summary?.completeMonths ?? 0,
                      })}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
