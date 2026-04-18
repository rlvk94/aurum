"use client";

import { useTranslations } from "next-intl";
import type { RouterOutputs } from "~/trpc/react";
import { cn } from "~/app/_lib/utils";

import {
  ACCOUNT_TYPE_ICONS,
  colorForAccountType,
  type AccountType,
} from "../_lib/allocation-colors";
import { bpsFromCents, formatMoney, formatPercentBps } from "../_lib/format";

type Line = RouterOutputs["incomePlan"]["get"]["lines"][number];

type Segment = {
  id: string;
  label: string;
  accountType: AccountType | null;
  bps: number; // share of total income in basis points
  amountCents: number;
};

export function AllocationBar({
  totalIncome,
  lines,
  allocatedBps,
  overAllocated,
}: {
  totalIncome: number;
  lines: Line[];
  allocatedBps: number;
  overAllocated: boolean;
}) {
  const t = useTranslations("incomePlanner");

  const segments: Segment[] = lines.map((line) => {
    let amountCents: number;
    let bps: number;
    if (line.allocationType === "percentage") {
      bps = line.value;
      amountCents = Math.round((totalIncome * line.value) / 10_000);
    } else {
      amountCents = line.value;
      bps = bpsFromCents(line.value, totalIncome);
    }
    return {
      id: line.id,
      label: line.accountName ?? t("accountDeleted"),
      accountType: (line.accountType as AccountType | null) ?? null,
      bps,
      amountCents,
    };
  });

  const safeAllocated = Math.min(10_000, allocatedBps);
  const unallocatedBps = Math.max(0, 10_000 - safeAllocated);

  return (
    <div className="space-y-4">
      {/* Summary strip above the bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em]">
        <span className="text-muted-foreground">{t("allocation")}</span>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "tabular-nums",
              overAllocated
                ? "text-expense"
                : safeAllocated === 10_000
                  ? "text-income"
                  : "text-foreground/70",
            )}
          >
            {overAllocated
              ? t("overAllocated")
              : `${formatPercentBps(safeAllocated)} ${t("allocatedLower")}`}
          </span>
          {!overAllocated && unallocatedBps > 0 && (
            <span className="text-muted-foreground">
              · {t("unallocatedAmount", {
                amount: formatMoney(Math.round((totalIncome * unallocatedBps) / 10_000)),
              })}
            </span>
          )}
        </div>
      </div>

      {/* The bar itself */}
      <div
        role="img"
        aria-label={t("allocation")}
        className="relative flex h-14 w-full overflow-hidden rounded-2xl ring-1 ring-border"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, var(--muted), var(--muted) 8px, var(--background) 8px, var(--background) 16px)",
        }}
      >
        {segments.length === 0 && totalIncome === 0 && (
          <div className="flex w-full items-center justify-center text-xs text-muted-foreground">
            {t("noAllocationsYet")}
          </div>
        )}

        {segments.map((seg) => {
          const color = colorForAccountType(seg.accountType);
          const Icon = seg.accountType
            ? ACCOUNT_TYPE_ICONS[seg.accountType]
            : null;
          const widthPct = Math.min(100, seg.bps / 100);
          const isNarrow = widthPct < 7;
          return (
            <div
              key={seg.id}
              className="group relative h-full transition-[flex-basis] duration-500 ease-out"
              style={{
                flexBasis: `${widthPct}%`,
                backgroundColor: color.bg,
              }}
              title={`${seg.label} · ${formatPercentBps(seg.bps)} · ${formatMoney(seg.amountCents)}`}
            >
              {!isNarrow && Icon && (
                <div className="flex h-full items-center gap-2 px-3 text-white/95">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate text-[11px] font-medium uppercase tracking-wide">
                    {seg.label}
                  </span>
                  <span className="ml-auto tabular-nums text-[11px] font-semibold">
                    {formatPercentBps(seg.bps)}
                  </span>
                </div>
              )}
              {/* subtle sheen */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent"
              />
              {/* hover tooltip for narrow segments */}
              {isNarrow && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground opacity-0 shadow-elevated transition-opacity group-hover:opacity-100">
                  {seg.label} · {formatPercentBps(seg.bps)}
                </div>
              )}
            </div>
          );
        })}

        {/* Over-allocation indicator strip */}
        {overAllocated && (
          <div className="absolute inset-y-0 right-0 flex items-center gap-2 border-l border-white/20 bg-expense px-3 text-[11px] font-semibold uppercase tracking-wide text-expense-foreground">
            {t("overAllocated")}
          </div>
        )}
      </div>
    </div>
  );
}
