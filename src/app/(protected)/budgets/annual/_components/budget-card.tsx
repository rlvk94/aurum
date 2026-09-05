"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import { BudgetSummary } from "./budget-summary";

type Budget = RouterOutputs["budget"]["list"][number];

export function BudgetCard({
  budget,
  index,
  now,
  onEdit,
  onCopy,
  onDelete,
}: {
  budget: Budget;
  index: number;
  now: Date;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");

  return (
    <BudgetSummary
      name={budget.name}
      year={budget.year}
      description={budget.description}
      accountIds={budget.accountIds}
      lineCount={budget.lineCount}
      plannedByMonth={budget.plannedByMonth}
      actualByMonth={budget.actualByMonth}
      now={now}
      headingLevel={2}
      compact
      className="group hover:border-primary/40 hover:shadow-elevated opacity-0 transition-[box-shadow,border-color] duration-300"
      style={{
        animation: "almanac-rise 0.55s ease-out forwards",
        animationDelay: `${60 + index * 60}ms`,
      }}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-70 transition-opacity group-hover:opacity-100"
              aria-label={tCommon("more")}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil />
              {tCommon("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopy}>
              <Copy />
              {t("copyBudget")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 />
              {t("deleteBudget")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <Link
        href={`/budgets/annual/${budget.id}`}
        className="focus-visible:ring-primary absolute inset-0 z-[1] rounded-[inherit] focus-visible:ring-2 focus-visible:outline-none"
        aria-label={budget.name}
      />
    </BudgetSummary>
  );
}
