"use client";

import { useTranslations } from "next-intl";
import { cn } from "~/app/_lib/utils";

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} kr.`;
}

const percentFormatter = new Intl.NumberFormat("da-DK", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatPercent(pct: number): string {
  return percentFormatter.format(pct / 100);
}

export function CategorySplit({
  entries,
  totalCents,
}: {
  entries: Array<{
    categoryId: string | null;
    categoryName: string | null;
    categoryIcon: string | null;
    totalCents: number;
  }>;
  totalCents: number;
}) {
  const t = useTranslations("accounts.detail");

  const rows = entries
    .filter((e) => e.totalCents > 0)
    .map((e) => ({
      ...e,
      pct: totalCents === 0 ? 0 : (e.totalCents / totalCents) * 100,
      isUncategorized: e.categoryId === null,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  const maxPct = rows[0]?.pct ?? 0;

  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const barWidth = maxPct === 0 ? 0 : (r.pct / maxPct) * 100;
        return (
          <li
            key={r.categoryId ?? "uncategorized"}
            className="bg-muted/40 relative h-12 overflow-hidden rounded-lg"
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-lg transition-[width] duration-500 ease-out",
                r.isUncategorized ? "bg-muted-foreground/15" : "bg-primary/15",
              )}
              style={{ width: `${barWidth}%` }}
              aria-hidden
            />
            <div className="relative flex h-full items-center gap-3 px-4">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {r.categoryIcon && (
                  <span className="text-base leading-none" aria-hidden>
                    {r.categoryIcon}
                  </span>
                )}
                <span className="text-foreground truncate text-sm font-medium">
                  {r.isUncategorized ? t("uncategorized") : r.categoryName}
                </span>
                <span className="bg-background/80 text-foreground shadow-card shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums">
                  {formatPercent(r.pct)}
                </span>
              </div>
              <span className="text-foreground shrink-0 text-sm font-medium tabular-nums">
                {formatAmount(r.totalCents)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CategorySplitSkeleton() {
  return (
    <ul className="space-y-3" aria-hidden>
      {[72, 58, 44, 32, 22, 14].map((w, i) => (
        <li
          key={i}
          className="bg-muted/40 relative h-12 overflow-hidden rounded-lg"
        >
          <div
            className="bg-muted absolute inset-y-0 left-0 animate-pulse rounded-lg"
            style={{ width: `${w}%` }}
          />
        </li>
      ))}
    </ul>
  );
}
