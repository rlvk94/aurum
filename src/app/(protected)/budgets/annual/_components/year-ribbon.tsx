"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { formatMoney } from "~/app/(protected)/income-planner/_lib/format";
import {
  cellState,
  fillClass,
  parseMonthsShort,
  trackClass,
  varianceTextClass,
} from "../_lib/budget-format";

type Size = "sm" | "lg";

export function YearRibbon({
  planned,
  actual,
  year,
  size = "sm",
  currentMonthIndex,
}: {
  planned: number[];
  actual: number[];
  year: number;
  size?: Size;
  currentMonthIndex?: number | null;
}) {
  const t = useTranslations("budgets");
  const months = useMemo(() => parseMonthsShort(t("monthsShort")), [t]);

  const max = useMemo(() => {
    let m = 1;
    for (let i = 0; i < 12; i++) {
      m = Math.max(m, planned[i] ?? 0, actual[i] ?? 0);
    }
    return m;
  }, [planned, actual]);

  const isLarge = size === "lg";
  const barHeight = isLarge ? "h-24" : "h-10";

  return (
    <div
      className={`grid w-full grid-cols-12 ${isLarge ? "gap-2" : "gap-0.5"}`}
      aria-hidden="true"
    >
      {months.map((label, i) => {
        const p = planned[i] ?? 0;
        const a = actual[i] ?? 0;
        const state = cellState(p, a);
        const plannedPct = Math.max(2, (p / max) * 100);
        const actualPct = p > 0 ? Math.min(140, (a / p) * 100) : a > 0 ? 100 : 0;
        const isNow = currentMonthIndex === i;

        return (
          <div
            key={i}
            className={`group relative flex flex-col items-stretch ${
              isLarge ? "gap-1.5" : "gap-1"
            }`}
          >
            <div
              className={`relative overflow-hidden rounded-[3px] ${barHeight} ${trackClass(
                state,
              )} ${isNow ? "ring-1 ring-primary/70 ring-offset-1 ring-offset-background" : ""}`}
            >
              <div
                className="absolute bottom-0 left-0 right-0 border-t border-dashed border-primary/35"
                style={{ height: `${plannedPct}%` }}
              />
              <div
                className={`absolute bottom-0 left-0 right-0 origin-bottom transition-[height] duration-500 ease-out ${fillClass(
                  state,
                )}`}
                style={{
                  height: `${Math.min(100, (a / max) * 100)}%`,
                }}
              />
              {isLarge && state === "over" && (
                <div
                  className="absolute left-0 right-0 h-px bg-expense"
                  style={{ bottom: `${(p / max) * 100}%` }}
                />
              )}
            </div>
            <div
              className={`flex items-baseline justify-between ${
                isLarge ? "gap-2 px-1" : "gap-1"
              }`}
            >
              <span
                className={`almanac-smallcaps ${
                  isLarge ? "text-[10px]" : "text-[9px]"
                } ${isNow ? "text-primary" : "text-muted-foreground"}`}
              >
                <span className="sm:hidden">{label.charAt(0)}</span>
                <span className="hidden sm:inline">{label}</span>
              </span>
              {isLarge && (
                <span
                  className={`hidden sm:inline-block almanac-numerals text-[11px] ${varianceTextClass(
                    p,
                    a,
                  )}`}
                >
                  {a > 0 ? formatMoney(a) : "·"}
                </span>
              )}
            </div>
            {isLarge && (
              <span className="hidden sm:inline-block almanac-numerals text-[10px] text-muted-foreground/80 px-1">
                {p > 0 ? formatMoney(p) : "—"}
              </span>
            )}
            {/* Subtle actual pct overshoot marker */}
            {!isLarge && actualPct > 100 && (
              <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[7px] text-expense">
                ●
              </span>
            )}
            <span className="sr-only">
              {label}: {formatMoney(a)} / {formatMoney(p)} ({year})
            </span>
          </div>
        );
      })}
    </div>
  );
}
