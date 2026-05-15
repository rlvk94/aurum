"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Skeleton } from "~/app/_components/skeleton";
import { usePageMetadata } from "~/app/_components/page-metadata";
import { formatMoney } from "~/app/(protected)/income-planner/_lib/format";
import {
  expectedProgressFractions,
  sumArray,
} from "../../_lib/budget-format";
import { buildBudgetTree, sumMonths } from "../../_lib/budget-tree";
import { YearRibbon } from "../../_components/year-ribbon";
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
    budget
      ? { title: budget.name, parentPath: "/budgets/annual" }
      : null,
  );

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Line | null>(null);
  const [drillTarget, setDrillTarget] = useState<DrillDownTarget | null>(null);

  const invalidate = () => {
    void utils.budget.get.invalidate({ id: budgetId });
    void utils.budget.list.invalidate();
  };

  const deleteLine = api.budget.deleteLine.useMutation({ onSuccess: invalidate });
  const updateCell = api.budget.updateCell.useMutation({ onSuccess: invalidate });

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

  const paceMetrics = useMemo(() => {
    if (!budget || !aggregates) return null;
    const plannedYear = sumArray(aggregates.plannedByMonth);
    const actualYear = sumArray(aggregates.actualByMonth);

    const fractions = expectedProgressFractions(budget.year, now);
    let plannedSoFar = 0;
    for (let i = 0; i < 12; i++) {
      plannedSoFar += (aggregates.plannedByMonth[i] ?? 0) * (fractions[i] ?? 0);
    }
    const remaining = plannedYear - actualYear;
    const varianceToPace = actualYear - plannedSoFar;
    const onPace = plannedSoFar > 0 ? actualYear <= plannedSoFar * 1.02 : null;
    const pctUsed =
      plannedYear > 0 ? Math.min(140, (actualYear / plannedYear) * 100) : 0;

    return {
      plannedYear,
      actualYear,
      remaining,
      plannedSoFar,
      varianceToPace,
      onPace,
      pctUsed,
    };
  }, [budget, aggregates, now]);

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
  const isCurrentYear = budget.year === now.getFullYear();

  return (
    <div className="min-w-0 space-y-8">
      {/* HERO */}
      <section className="almanac-grain relative overflow-hidden rounded-[18px] border border-border bg-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -right-24 bottom-0 h-56 w-56 rounded-full bg-accent blur-3xl opacity-60" />
        </div>

        <div className="relative px-6 pb-10 pt-8 md:px-10 md:pb-12 md:pt-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="almanac-smallcaps text-[11px] text-primary">
                  {t("chapter")}
                </span>
                <span className="h-px w-10 bg-primary/40" />
                <span className="font-display text-lg text-foreground almanac-numerals">
                  {budget.year}
                </span>
                {isCurrentYear && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary almanac-smallcaps">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-primary" />
                    {t("current")}
                  </span>
                )}
              </div>
              <h1 className="mt-3 font-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[1.02] text-foreground">
                {budget.name}
              </h1>
              {budget.description && (
                <p className="mt-3 max-w-xl text-sm text-muted-foreground">
                  {budget.description}
                </p>
              )}
              <ScopeLine accountIds={budget.accountIds} />
            </div>

            <Button
              size="lg"
              onClick={() => setAddOpen(true)}
              className="shadow-card"
            >
              <Plus />
              {t("addLine")}
            </Button>
          </div>

          <div className="almanac-rule mt-8" />

          {/* At-a-glance metrics */}
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4">
            <HeroMetric
              label={t("plannedForYear")}
              value={formatMoney(paceMetrics?.plannedYear ?? 0)}
            />
            <HeroMetric
              label={t("spentToDate")}
              value={formatMoney(paceMetrics?.actualYear ?? 0)}
              accent={
                (paceMetrics?.actualYear ?? 0) >
                (paceMetrics?.plannedYear ?? 0)
                  ? "expense"
                  : "income"
              }
            />
            <HeroMetric
              label={t("remainingForYear")}
              value={formatMoney(Math.max(0, paceMetrics?.remaining ?? 0))}
              accent={(paceMetrics?.remaining ?? 0) < 0 ? "expense" : "muted"}
            />
            <HeroMetric
              label={t("pace")}
              value={
                paceMetrics?.onPace === null
                  ? "—"
                  : paceMetrics?.onPace
                    ? t("paceOnTrack")
                    : t("paceOffTrack")
              }
              supplemental={
                paceMetrics && paceMetrics.plannedSoFar > 0
                  ? `${
                      paceMetrics.varianceToPace >= 0 ? "+" : "−"
                    }${formatMoney(Math.abs(paceMetrics.varianceToPace))}`
                  : undefined
              }
              accent={
                paceMetrics?.onPace === null
                  ? "muted"
                  : paceMetrics?.onPace
                    ? "income"
                    : "expense"
              }
            />
          </dl>

          {/* Year ribbon */}
          {paceMetrics && paceMetrics.plannedYear > 0 && (
            <div className="mt-10 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="almanac-smallcaps text-[10px] text-muted-foreground">
                  {t("twelveMonths")}
                </span>
                <span className="almanac-smallcaps text-[10px] text-muted-foreground">
                  {t("usedPct", {
                    pct: Math.round(paceMetrics.pctUsed).toString(),
                  })}
                </span>
              </div>
              <div className="-mx-1">
                <YearRibbon
                  planned={planned}
                  actual={actual}
                  year={budget.year}
                  size="lg"
                  currentMonthIndex={currentMonthIndex ?? undefined}
                />
              </div>
            </div>
          )}
        </div>
      </section>

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

function ScopeLine({ accountIds }: { accountIds: string[] }) {
  const t = useTranslations("budgets");
  const { data: accounts } = api.financialAccount.list.useQuery();

  const names = useMemo(() => {
    if (accountIds.length === 0 || !accounts) return null;
    const byId = new Map(accounts.map((a) => [a.id, a.name]));
    return accountIds
      .map((id) => byId.get(id))
      .filter((n): n is string => Boolean(n));
  }, [accountIds, accounts]);

  return (
    <p className="mt-4 flex flex-wrap items-center gap-2 text-xs">
      <span className="almanac-smallcaps text-[10px] text-muted-foreground">
        {t("scopedTo")}
      </span>
      {!names || names.length === 0 ? (
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
          {t("allAccounts")}
        </span>
      ) : (
        names.map((n) => (
          <span
            key={n}
            className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-accent-foreground"
          >
            {n}
          </span>
        ))
      )}
    </p>
  );
}

function HeroMetric({
  label,
  value,
  supplemental,
  accent = "muted",
}: {
  label: string;
  value: string;
  supplemental?: string;
  accent?: "muted" | "income" | "expense";
}) {
  const color =
    accent === "income"
      ? "text-income"
      : accent === "expense"
        ? "text-expense"
        : "text-foreground";
  return (
    <div>
      <dt className="almanac-smallcaps text-[10px] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1.5 font-display text-[26px] leading-none almanac-numerals ${color}`}
      >
        {value}
      </dd>
      {supplemental && (
        <p
          className={`mt-1 text-[11px] almanac-numerals ${
            accent === "expense"
              ? "text-expense"
              : accent === "income"
                ? "text-income"
                : "text-muted-foreground"
          }`}
        >
          {supplemental}
        </p>
      )}
    </div>
  );
}
