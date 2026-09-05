"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Skeleton } from "~/app/_components/skeleton";
import { usePageMetadata } from "~/app/_components/page-metadata";
import { buildBudgetTree, sumMonths } from "../../_lib/budget-tree";
import { BudgetSummary } from "../../_components/budget-summary";
import { BudgetGrid } from "./budget-grid";
import { AddLineDialog } from "./add-line-dialog";
import { EditLineDialog } from "./edit-line-dialog";
import {
  BudgetTransactionsSheet,
  type DrillDownTarget,
} from "./budget-transactions-sheet";

type BudgetDetail = RouterOutputs["budget"]["get"];
type Line = BudgetDetail["lines"][number];

export function BudgetDetailClient({ budgetId }: { budgetId: string }) {
  const t = useTranslations("budgets");
  const utils = api.useUtils();

  const { data: budget, isLoading } = api.budget.get.useQuery({ id: budgetId });

  // Surface the budget name as the leaf breadcrumb once it's loaded.
  usePageMetadata(
    budget ? { title: budget.name, parentPath: "/budgets/annual" } : null,
  );

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Line | null>(null);
  const [drillTarget, setDrillTarget] = useState<DrillDownTarget | null>(null);

  const invalidate = () => {
    void utils.budget.get.invalidate({ id: budgetId });
    void utils.budget.list.invalidate();
  };

  const deleteLine = api.budget.deleteLine.useMutation({
    onSuccess: invalidate,
  });
  const updateCell = api.budget.updateCell.useMutation({
    onSuccess: invalidate,
  });

  const { data: categories } = api.category.list.useQuery();

  const aggregates = useMemo(() => {
    if (!budget) return null;
    const tree = buildBudgetTree(
      budget.lines,
      categories ?? [],
      budget.categoryActuals,
      t("categoryDeleted"),
    );
    return sumMonths(tree);
  }, [budget, categories, t]);

  const now = useMemo(() => new Date(), []);

  const currentMonthIndex = useMemo(() => {
    if (!budget) return null;
    if (now.getFullYear() !== budget.year) return null;
    return now.getMonth();
  }, [budget, now]);

  const handleDelete = (line: Line) => {
    if (confirm(t("deleteLineConfirm"))) {
      deleteLine.mutate({ id: line.id });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-48 w-full rounded-[18px]" />
        <Skeleton className="h-64 w-full rounded-[14px]" />
      </div>
    );
  }

  if (!budget) return null;

  const planned = aggregates?.plannedByMonth ?? new Array<number>(12).fill(0);
  const actual = aggregates?.actualByMonth ?? new Array<number>(12).fill(0);

  return (
    <div className="min-w-0 space-y-8">
      <BudgetSummary
        name={budget.name}
        year={budget.year}
        description={budget.description}
        accountIds={budget.accountIds}
        lineCount={budget.lines.length}
        plannedByMonth={planned}
        actualByMonth={actual}
        now={now}
        actions={
          <Button
            size="lg"
            onClick={() => setAddOpen(true)}
            className="shadow-card"
          >
            <Plus />
            {t("addLine")}
          </Button>
        }
      />

      <BudgetGrid
        budget={budget}
        onEditLine={(l) => setEditing(l)}
        onDeleteLine={handleDelete}
        onUpdateCell={(lineId, monthIndex, amount) =>
          updateCell.mutate({ lineId, monthIndex, amount })
        }
        onAddLine={() => setAddOpen(true)}
        onDrillDown={setDrillTarget}
        currentMonthIndex={currentMonthIndex}
      />

      <AddLineDialog
        budgetId={budgetId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
      <EditLineDialog
        key={editing?.id}
        budgetId={budgetId}
        line={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <BudgetTransactionsSheet
        target={drillTarget}
        open={Boolean(drillTarget)}
        onOpenChange={(open) => !open && setDrillTarget(null)}
      />
    </div>
  );
}
