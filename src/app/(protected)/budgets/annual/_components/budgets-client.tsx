"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, Plus } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { PageHeader } from "~/app/_components/page-header";
import { BudgetCard } from "./budget-card";
import { BudgetFormDialog } from "./budget-form-dialog";
import { CopyBudgetDialog } from "./copy-budget-dialog";

type Budget = RouterOutputs["budget"]["list"][number];

export function BudgetsClient() {
  const t = useTranslations("budgets");
  const utils = api.useUtils();

  const { data: budgets, isLoading } = api.budget.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [copying, setCopying] = useState<Budget | null>(null);

  const invalidate = () => void utils.budget.list.invalidate();
  const deleteBudget = api.budget.delete.useMutation({ onSuccess: invalidate });

  // Server returns budgets sorted by year desc, then name — one card each.
  const now = useMemo(() => new Date(), []);

  if (isLoading) return null;

  const handleDelete = (b: Budget) => {
    if (confirm(t("deleteBudgetConfirm", { name: b.name }))) {
      deleteBudget.mutate({ id: b.id });
    }
  };

  const hasBudgets = (budgets?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("annualBudgets")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("createBudget")}
          </Button>
        }
      />

      {!hasBudgets ? (
        <EmptyChapter onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="space-y-6">
          {budgets!.map((b, i) => (
            <BudgetCard
              key={b.id}
              budget={b}
              index={i}
              now={now}
              onEdit={() => setEditing(b)}
              onCopy={() => setCopying(b)}
              onDelete={() => handleDelete(b)}
            />
          ))}
        </div>
      )}

      <BudgetFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <BudgetFormDialog
        key={editing?.id}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        budget={editing ?? undefined}
      />
      <CopyBudgetDialog
        key={copying?.id}
        open={Boolean(copying)}
        onOpenChange={(open) => !open && setCopying(null)}
        budget={copying}
      />
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
