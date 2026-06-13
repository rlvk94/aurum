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
      <div className="bg-primary/10 absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl" />
      <div className="bg-accent absolute bottom-0 -left-24 h-56 w-56 rounded-full opacity-60 blur-3xl" />
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
      <section className="almanac-grain border-border bg-card relative overflow-hidden rounded-[18px] border px-5 py-8 sm:px-8 sm:py-10 md:px-12 md:py-14">
        <HeroBackdrop />
        <div className="relative grid gap-6 sm:gap-8 md:grid-cols-[1.2fr_1fr] md:items-end">
          <div>
            <p className="almanac-smallcaps text-primary text-[11px]">
              {t("almanacLabel")}
            </p>
            <h1 className="font-display text-foreground mt-3 text-[clamp(2.5rem,5vw,4.25rem)] leading-[0.98]">
              {t("almanacHeadline")}
            </h1>
            <p className="text-muted-foreground mt-4 max-w-xl text-sm">
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
                <span className="almanac-smallcaps text-muted-foreground text-[10px]">
                  {t("chaptersCount", { count: grouped.length })}
                </span>
              )}
            </div>
          </div>

          {hasBudgets ? (
            <dl className="border-border/70 bg-background/50 grid grid-cols-3 gap-2 rounded-[12px] border p-4 backdrop-blur">
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
            <div className="border-primary/30 bg-primary/5 text-primary/80 flex items-center gap-3 rounded-[12px] border border-dashed p-4 text-xs">
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
                    <h2 className="font-display text-foreground almanac-numerals text-[clamp(2.5rem,9vw,5.5rem)] leading-none">
                      {year}
                    </h2>
                    {isCurrentYear && (
                      <span className="bg-primary/10 text-primary almanac-smallcaps inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium">
                        <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
                        {t("current")}
                      </span>
                    )}
                  </div>
                  <div className="hidden flex-1 sm:block">
                    <div className="almanac-rule" />
                  </div>
                  <span className="almanac-smallcaps text-muted-foreground shrink-0 text-[10px]">
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
        open={Boolean(editing)}
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
      <dt className="almanac-smallcaps text-muted-foreground text-[9px]">
        {label}
      </dt>
      <dd
        className={`almanac-numerals mt-1 leading-tight ${
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
    <div className="border-border bg-card relative overflow-hidden rounded-[18px] border border-dashed px-5 py-12 sm:px-8 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
      >
        <div className="bg-primary/8 absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
      </div>
      <div className="relative mx-auto flex max-w-lg flex-col items-center text-center">
        <BookOpen className="text-primary/70 h-10 w-10" />
        <h2 className="font-display text-foreground mt-6 text-3xl">
          {t("almanacEmptyHeadline")}
        </h2>
        <p className="text-muted-foreground mt-3 text-sm">
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
