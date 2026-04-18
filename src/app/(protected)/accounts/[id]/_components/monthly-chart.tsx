"use client";

import { useLocale, useTranslations } from "next-intl";
import { format, parse } from "date-fns";
import { da, enUS } from "date-fns/locale";

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    maximumFractionDigits: 0,
  }).format(value);
  return `${formatted} kr.`;
}

export function MonthlyChart({
  monthly,
}: {
  monthly: Array<{ month: string; incomeCents: number; expenseCents: number }>;
}) {
  const t = useTranslations("accounts.detail");
  const locale = useLocale();
  const dateLocale = locale === "da" ? da : enUS;

  const max = Math.max(
    1,
    ...monthly.map((m) => Math.max(m.incomeCents, m.expenseCents)),
  );

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 sm:gap-3" style={{ height: 180 }}>
        {monthly.map((m) => {
          const incomeH = (m.incomeCents / max) * 160;
          const expenseH = (m.expenseCents / max) * 160;
          const hasData = m.incomeCents > 0 || m.expenseCents > 0;
          return (
            <div
              key={m.month}
              className="group relative flex flex-1 flex-col items-center justify-end gap-1"
              style={{ height: 160 }}
            >
              <div className="flex h-full w-full items-end justify-center gap-0.5">
                <div
                  className="w-1/2 rounded-sm bg-income transition-all"
                  style={{
                    height: `${incomeH}px`,
                    minHeight: m.incomeCents > 0 ? 2 : 0,
                  }}
                  aria-label={`${t("totalIncome")} ${formatAmount(m.incomeCents)}`}
                />
                <div
                  className="w-1/2 rounded-sm bg-expense transition-all"
                  style={{
                    height: `${expenseH}px`,
                    minHeight: m.expenseCents > 0 ? 2 : 0,
                  }}
                  aria-label={`${t("totalExpense")} ${formatAmount(m.expenseCents)}`}
                />
              </div>
              {hasData && (
                <div className="pointer-events-none absolute bottom-full mb-2 hidden whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-elevated group-hover:block">
                  <p className="font-medium">
                    {format(parse(`${m.month}-01`, "yyyy-MM-dd", new Date()), "MMMM yyyy", { locale: dateLocale })}
                  </p>
                  <p className="text-income">
                    + {formatAmount(m.incomeCents)}
                  </p>
                  <p className="text-expense">
                    − {formatAmount(m.expenseCents)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-end gap-2 sm:gap-3">
        {monthly.map((m) => (
          <div
            key={m.month}
            className="flex-1 text-center text-xs text-muted-foreground"
          >
            {format(parse(`${m.month}-01`, "yyyy-MM-dd", new Date()), "MMM", { locale: dateLocale })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-income" />
          {t("totalIncome")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-expense" />
          {t("totalExpense")}
        </span>
      </div>
    </div>
  );
}
