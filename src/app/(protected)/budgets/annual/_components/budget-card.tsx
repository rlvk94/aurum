"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import { formatMoney } from "~/app/(protected)/income-planner/_lib/format";
import { variancePillClass, varianceTextClass } from "../_lib/budget-format";

type Budget = RouterOutputs["budget"]["list"][number];

export function BudgetCard({
  budget,
  index,
  isCurrentYear,
  onEdit,
  onDelete,
}: {
  budget: Budget;
  index: number;
  isCurrentYear: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");

  const variance = budget.totalPlanned - budget.totalActual;
  const pct =
    budget.totalPlanned > 0
      ? Math.min(140, (budget.totalActual / budget.totalPlanned) * 100)
      : 0;

  return (
    <article
      className="group border-border bg-card hover:border-primary/40 hover:shadow-elevated relative overflow-hidden rounded-[10px] border opacity-0 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5"
      style={{
        animation: "almanac-rise 0.55s ease-out forwards",
        animationDelay: `${60 + index * 60}ms`,
      }}
    >
      <Link
        href={`/budgets/annual/${budget.id}`}
        className="focus-visible:ring-primary absolute inset-0 z-[1] rounded-[inherit] focus-visible:ring-2 focus-visible:outline-none"
        aria-label={budget.name}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent 4%, hsl(38 60% 50% / 0.6) 50%, transparent 96%)",
        }}
      />

      <div className="absolute top-3 right-3 z-[2]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-60 transition-opacity group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil />
              {tCommon("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 />
              {t("deleteBudget")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-4 p-5">
        <header className="space-y-1 pr-10">
          <p className="almanac-smallcaps text-muted-foreground text-[10px]">
            {isCurrentYear ? t("inProgress") : t("chapter")}
          </p>
          <h3 className="font-display text-foreground text-2xl leading-tight">
            {budget.name}
          </h3>
          <p className="almanac-numerals text-muted-foreground text-xs">
            {t("lineCount", { count: budget.lineCount })}
          </p>
        </header>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="almanac-smallcaps text-muted-foreground text-[9px]">
              {t("planned")}
            </p>
            <p className="font-display text-foreground almanac-numerals text-[28px] leading-none">
              {formatMoney(budget.totalPlanned)}
            </p>
          </div>
          <div className="text-right">
            <p className="almanac-smallcaps text-muted-foreground text-[9px]">
              {t("actual")}
            </p>
            <p
              className={`almanac-numerals text-sm font-medium ${varianceTextClass(
                budget.totalPlanned,
                budget.totalActual,
              )}`}
            >
              {formatMoney(budget.totalActual)}
            </p>
          </div>
        </div>

        {budget.totalPlanned > 0 && (
          <div className="bg-muted relative h-1 overflow-hidden rounded-full">
            <div
              className={`h-full origin-left transition-transform duration-700 ease-out ${
                budget.totalActual > budget.totalPlanned
                  ? "bg-expense"
                  : "bg-primary"
              }`}
              style={{ transform: `scaleX(${Math.max(0.02, pct / 100)})` }}
            />
            {budget.totalActual > budget.totalPlanned && (
              <div className="bg-foreground/20 absolute inset-y-0 right-0 w-px" />
            )}
          </div>
        )}

        <footer className="border-border/70 flex items-center justify-between border-t pt-3 text-[11px]">
          <span className="almanac-smallcaps text-muted-foreground">
            {t("variance")}
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`almanac-numerals inline-flex items-center rounded-full px-2 py-0.5 ${variancePillClass(
                budget.totalPlanned,
                budget.totalActual,
              )}`}
            >
              {variance >= 0 ? "+" : ""}
              {formatMoney(Math.abs(variance))}
            </span>
            <ArrowUpRight className="text-muted-foreground group-hover:text-primary h-3.5 w-3.5 transition-[transform,color] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </footer>
      </div>
    </article>
  );
}
