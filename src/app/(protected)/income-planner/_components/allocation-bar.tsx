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
  bps: number;
  amountCents: number;
  color: string;
};

// Donut geometry. Drawn into a 200x200 viewBox; scaled responsively via CSS.
const VIEWBOX = 200;
const CENTER = VIEWBOX / 2;
const RADIUS = 78;
const STROKE = 22;

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.sin(angleRad),
    y: cy - r * Math.cos(angleRad),
  };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

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
    const accountType = (line.accountType as AccountType | null) ?? null;
    return {
      id: line.id,
      label: line.accountName ?? t("accountDeleted"),
      accountType,
      bps,
      amountCents,
      color: colorForAccountType(accountType).bg,
    };
  });

  const safeAllocated = Math.min(10_000, allocatedBps);
  const unallocatedBps = Math.max(0, 10_000 - safeAllocated);
  const empty = segments.length === 0 && totalIncome === 0;

  // Build donut wedges, capping cumulative draw at 100% so segments past the
  // ring are not duplicated. The legend still shows real bps for each line.
  type Wedge = {
    seg: Segment;
    startAngle: number;
    endAngle: number;
    draw: number;
  };
  const { wedges } = segments.reduce<{ wedges: Wedge[]; drawnBps: number }>(
    (acc, seg) => {
      const remaining = Math.max(0, 10_000 - acc.drawnBps);
      const draw = Math.min(seg.bps, remaining);
      const startAngle = (acc.drawnBps / 10_000) * 2 * Math.PI;
      const nextDrawn = acc.drawnBps + draw;
      const endAngle = (nextDrawn / 10_000) * 2 * Math.PI;
      return {
        wedges: [...acc.wedges, { seg, startAngle, endAngle, draw }],
        drawnBps: nextDrawn,
      };
    },
    { wedges: [], drawnBps: 0 },
  );

  const isFullSingle =
    wedges.length === 1 && Math.abs(wedges[0]!.endAngle - wedges[0]!.startAngle - 2 * Math.PI) < 1e-6;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
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
          {!overAllocated && unallocatedBps > 0 && totalIncome > 0 && (
            <span className="text-muted-foreground">
              · {t("unallocatedAmount", {
                amount: formatMoney(
                  Math.round((totalIncome * unallocatedBps) / 10_000),
                ),
              })}
            </span>
          )}
        </div>
      </div>

      {/* Chart + legend: stacked on small screens, side-by-side on desktop. */}
      <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:gap-10">
        <div className="relative shrink-0">
          <svg
            viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
            className="h-44 w-44 sm:h-48 sm:w-48"
            role="img"
            aria-label={t("allocation")}
          >
            {/* Unallocated track */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={STROKE}
            />

            {/* Special-case: a single segment that fills the entire ring would
                produce a degenerate arc path, so render as a full circle. */}
            {isFullSingle && (
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                style={{ stroke: wedges[0]!.seg.color }}
              />
            )}

            {!isFullSingle &&
              wedges.map(({ seg, startAngle, endAngle, draw }) =>
                draw <= 0 ? null : (
                  <path
                    key={seg.id}
                    d={arcPath(CENTER, CENTER, RADIUS, startAngle, endAngle)}
                    fill="none"
                    strokeWidth={STROKE}
                    strokeLinecap="butt"
                    style={{ stroke: seg.color }}
                  />
                ),
              )}
          </svg>

          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {empty ? (
              <span className="px-6 text-center text-xs text-muted-foreground">
                {t("noAllocationsYet")}
              </span>
            ) : (
              <>
                <span
                  className={cn(
                    "font-display text-3xl tabular-nums leading-none",
                    overAllocated
                      ? "text-expense"
                      : safeAllocated === 10_000
                        ? "text-income"
                        : "text-foreground",
                  )}
                >
                  {formatPercentBps(safeAllocated)}
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {t("allocatedLower")}
                </span>
              </>
            )}
          </div>

          {overAllocated && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-expense px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-expense-foreground shadow-sm">
              {t("overAllocated")}
            </div>
          )}
        </div>

        {segments.length > 0 && (
          <ul className="grid w-full gap-1.5 sm:grid-cols-2 lg:flex-1">
            {segments.map((seg) => {
              const Icon = seg.accountType
                ? ACCOUNT_TYPE_ICONS[seg.accountType]
                : null;
              return (
                <li
                  key={seg.id}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5"
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  {Icon && (
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    {seg.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
                    {formatPercentBps(seg.bps)}
                  </span>
                  <span className="shrink-0 tabular-nums text-xs font-semibold text-foreground">
                    {formatMoney(seg.amountCents)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
