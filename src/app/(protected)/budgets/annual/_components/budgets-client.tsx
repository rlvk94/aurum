"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, Plus, Sparkles } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { formatMoney } from "~/app/(protected)/income-planner/_lib/format";
import { BudgetCard } from "./budget-card";
import { BudgetFormDialog } from "./budget-form-dialog";

type Budget = RouterOutputs["budget"]["list"][number];

function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-accent blur-3xl opacity-60" />
    </div>
  );
}

export function BudgetsClient() {
  const t = useTranslations("budgets");
  const utils = api.useUtils();

  const { data: budgets, isLoading } = api.budget.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);

  const invalidate = () => void utils.budget.list.invalidate();
  const deleteBudget = api.budget.delete.useMutation({ onSuccess: invalidate });

  const { grouped, totals, currentYear } = useMemo(() => {
    const groups = new Map<number, Budget[]>();
    for (const b of budgets ?? []) {
      const list = groups.get(b.year) ?? [];
      list.push(b);
      groups.set(b.year, list);
    }
    const ordered = Array.from(groups.entries()).sort((a, b) => b[0] - a[0]);
    const cy = new Date().getFullYear();
    const current = groups.get(cy) ?? [];
    const totalPlanned = current.reduce((acc, b) => acc + b.totalPlanned, 0);
    const totalActual = current.reduce((acc, b) => acc + b.totalActual, 0);
    return {
      grouped: ordered,
      totals: {
        current: {
          planned: totalPlanned,
          actual: totalActual,
          count: current.length,
        },
      },
      currentYear: cy,
    };
  }, [budgets]);

  if (isLoading) return null;

  const handleDelete = (b: Budget) => {
    if (confirm(t("deleteBudgetConfirm", { name: b.name }))) {
      deleteBudget.mutate({ id: b.id });
    }
  };

  const hasBudgets = (budgets?.length ?? 0) > 0;

  return (
    <div className="space-y-12">
      {/* HERO */}
      <section className="almanac-grain relative overflow-hidden rounded-[18px] border border-border bg-card px-5 py-8 sm:px-8 sm:py-10 md:px-12 md:py-14">
        <HeroBackdrop />
        <div className="relative grid gap-6 sm:gap-8 md:grid-cols-[1.2fr_1fr] md:items-end">
          <div>
            <p className="almanac-smallcaps text-[11px] text-primary">
              {t("almanacLabel")}
            </p>
            <h1 className="mt-3 font-display text-[clamp(2.5rem,5vw,4.25rem)] leading-[0.98] text-foreground">
              {t("almanacHeadline")}
            </h1>
            <p className="mt-4 max-w-xl text-sm text-muted-foreground">
              {t("almanacSubhead")}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="shadow-card"
                onClick={() => setCreateOpen(true)}
              >
                <Plus />
                {t("createBudget")}
              </Button>
              {hasBudgets && (
                <span className="almanac-smallcaps text-[10px] text-muted-foreground">
                  {t("chaptersCount", { count: grouped.length })}
                </span>
              )}
            </div>
          </div>

          {hasBudgets ? (
            <dl className="grid grid-cols-3 gap-2 rounded-[12px] border border-border/70 bg-background/50 p-4 backdrop-blur">
              <Metric
                label={t("currentYear")}
                value={String(currentYear)}
                serif
              />
              <Metric
                label={t("plannedThisYear")}
                value={formatMoney(totals.current.planned)}
                accent={totals.current.planned > 0 ? "primary" : "muted"}
              />
              <Metric
                label={t("spentThisYear")}
                value={formatMoney(totals.current.actual)}
                accent={
                  totals.current.actual > totals.current.planned
                    ? "expense"
                    : "income"
                }
              />
            </dl>
          ) : (
            <div className="flex items-center gap-3 rounded-[12px] border border-dashed border-primary/30 bg-primary/5 p-4 text-xs text-primary/80">
              <Sparkles className="h-4 w-4 shrink-0" />
              <p>{t("almanacInvite")}</p>
            </div>
          )}
        </div>
      </section>

      {/* CONTENT */}
      {!hasBudgets ? (
        <EmptyChapter onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="space-y-14">
          {grouped.map(([year, items]) => {
            const isCurrentYear = year === currentYear;
            return (
              <section key={year} className="space-y-6">
                <header className="flex items-baseline justify-between gap-3 sm:gap-6">
                  <div className="flex min-w-0 items-baseline gap-2 sm:gap-4">
                    <h2 className="font-display text-[clamp(2.5rem,9vw,5.5rem)] leading-none text-foreground almanac-numerals">
                      {year}
                    </h2>
                    {isCurrentYear && (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary almanac-smallcaps">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                        {t("current")}
                      </span>
                    )}
                  </div>
                  <div className="hidden flex-1 sm:block">
                    <div className="almanac-rule" />
                  </div>
                  <span className="almanac-smallcaps shrink-0 text-[10px] text-muted-foreground">
                    {t("lineCount", { count: items.length })}
                  </span>
                </header>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((b, i) => (
                    <BudgetCard
                      key={b.id}
                      budget={b}
                      index={i}
                      isCurrentYear={isCurrentYear}
                      onEdit={() => setEditing(b)}
                      onDelete={() => handleDelete(b)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <BudgetFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <BudgetFormDialog
        key={editing?.id}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        budget={editing ?? undefined}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  serif,
  accent = "muted",
}: {
  label: string;
  value: string;
  serif?: boolean;
  accent?: "muted" | "primary" | "income" | "expense";
}) {
  const color =
    accent === "primary"
      ? "text-primary"
      : accent === "income"
        ? "text-income"
        : accent === "expense"
          ? "text-expense"
          : "text-foreground";
  return (
    <div>
      <dt className="almanac-smallcaps text-[9px] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1 almanac-numerals leading-tight ${
          serif ? "font-display text-2xl" : "text-sm font-medium"
        } ${color}`}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyChapter({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("budgets");
  return (
    <div className="relative overflow-hidden rounded-[18px] border border-dashed border-border bg-card px-5 py-12 sm:px-8 sm:py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-3xl" />
      </div>
      <div className="relative mx-auto flex max-w-lg flex-col items-center text-center">
        <BookOpen className="h-10 w-10 text-primary/70" />
        <h2 className="mt-6 font-display text-3xl text-foreground">
          {t("almanacEmptyHeadline")}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("budgetsEmptyState")}
        </p>
        <Button className="mt-7" size="lg" onClick={onCreate}>
          <Plus />
          {t("createBudget")}
        </Button>
      </div>
    </div>
  );
}
