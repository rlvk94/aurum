"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

import { type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/app/_components/badge";
import { cn } from "~/app/_lib/utils";

import { bpsFromCents, formatMoney, formatPercentBps } from "../_lib/format";

type Plan = RouterOutputs["incomePlan"]["list"][number];

export function PlanCard({
  plan,
  variant,
  archived = false,
}: {
  plan: Plan;
  variant: "hero" | "compact";
  archived?: boolean;
}) {
  const t = useTranslations("incomePlanner");

  const allocatedBps = Math.min(10_000, plan.allocatedPercentageBps);
  const fixedShareBps = bpsFromCents(plan.allocatedFixedCents, plan.totalIncome);
  const allocatedTotalBps = Math.min(10_000, allocatedBps + fixedShareBps);
  const overAllocated = allocatedBps + fixedShareBps > 10_050;

  const isHero = variant === "hero";

  return (
    <Link
      href={`/income-planner/${plan.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all",
        "hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        archived && "opacity-60",
        isHero && "px-6 py-7 sm:px-10 sm:py-10",
        !isHero && "p-5",
      )}
    >
      {isHero && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at top right, hsl(38 60% 50% / 0.10), transparent 55%)",
          }}
        />
      )}

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          {plan.isActive && !archived && (
            <Badge
              className="mb-3 gap-1 rounded-full border-0 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary"
              variant="secondary"
            >
              <Sparkles className="h-3 w-3" />
              {t("activeBadge")}
            </Badge>
          )}
          <h3
            className={cn(
              "truncate font-display text-foreground",
              isHero ? "text-2xl sm:text-3xl" : "text-lg",
            )}
          >
            {plan.name}
          </h3>
          {plan.description && (
            <p className={cn("mt-1 text-sm text-muted-foreground", !isHero && "line-clamp-2")}>
              {plan.description}
            </p>
          )}
        </div>
      </div>

      <div className={cn("relative mt-6", isHero && "sm:mt-10")}>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("monthlyIncome")}
          </span>
          <span
            className={cn(
              "text-[11px] uppercase tracking-[0.14em]",
              overAllocated
                ? "text-expense"
                : allocatedTotalBps === 10_000
                  ? "text-income"
                  : "text-muted-foreground",
            )}
          >
            {overAllocated
              ? t("overAllocated")
              : `${formatPercentBps(allocatedTotalBps)} ${t("allocatedLower")}`}
          </span>
        </div>
        <p
          className={cn(
            "mt-2 font-display tabular-nums text-foreground",
            isHero ? "text-5xl sm:text-6xl" : "text-3xl",
          )}
        >
          {formatMoney(plan.totalIncome)}
        </p>

        {/* Thin allocation-ratio bar */}
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              overAllocated
                ? "bg-expense"
                : allocatedTotalBps === 10_000
                  ? "bg-income"
                  : "bg-primary",
            )}
            style={{ width: `${Math.min(100, allocatedTotalBps / 100)}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            {plan.incomeCount} · {t("incomeSources").toLowerCase()}
          </span>
          <span className="tabular-nums">
            {plan.allocationLineCount} · {t("allocations").toLowerCase()}
          </span>
        </div>
      </div>
    </Link>
  );
}
