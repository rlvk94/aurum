"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Sparkles } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/app/_components/badge";
import { Button } from "~/app/_components/button";
import { usePageMetadata } from "~/app/_components/page-metadata";

import { AllocationBar } from "./allocation-bar";
import { AllocationsEditor } from "./allocations-editor";
import { CreatePlanDialog } from "./create-plan-dialog";
import { IncomeEditor } from "./income-editor";
import { bpsFromCents, formatMoney } from "../_lib/format";

type PlanFromList = RouterOutputs["incomePlan"]["list"][number];

export function PlanDetailClient({ planId }: { planId: string }) {
  const t = useTranslations("incomePlanner");
  const utils = api.useUtils();

  const { data: plan } = api.incomePlan.get.useQuery({ id: planId });
  const { data: accounts } = api.financialAccount.list.useQuery();

  const [editOpen, setEditOpen] = useState(false);

  const setActive = api.incomePlan.setActive.useMutation({
    onSuccess: () => {
      void utils.incomePlan.get.invalidate({ id: planId });
      void utils.incomePlan.list.invalidate();
    },
  });

  const totalIncome = useMemo(
    () => (plan?.incomes ?? []).reduce((s, i) => s + i.amount, 0),
    [plan?.incomes],
  );

  const { allocatedBps, overAllocated, allBpsAllocated } = useMemo(() => {
    if (!plan) return { allocatedBps: 0, overAllocated: false, allBpsAllocated: 0 };
    let bps = 0;
    for (const line of plan.lines) {
      if (line.allocationType === "percentage") {
        bps += line.value;
      } else {
        bps += bpsFromCents(line.value, totalIncome);
      }
    }
    return {
      allocatedBps: Math.min(10_000, bps),
      overAllocated: bps > 10_050, // tolerance for rounding
      allBpsAllocated: bps,
    };
  }, [plan, totalIncome]);

  usePageMetadata(
    plan ? { title: plan.name, parentPath: "/income-planner" } : null,
  );

  if (!plan) return null;

  const activeAccounts = (accounts ?? []).filter((a) => !a.archived);
  const planForEdit: PlanFromList = {
    ...plan,
    totalIncome,
    incomeCount: plan.incomes.length,
    allocationLineCount: plan.lines.length,
    allocatedPercentageBps: 0,
    allocatedFixedCents: 0,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end gap-2">
        {!plan.isActive && !plan.archived && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActive.mutate({ id: planId })}
          >
            <Sparkles />
            {t("setActive")}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil />
          {t("editPlan")}
        </Button>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-8 shadow-elevated sm:px-10 sm:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 15% 0%, hsl(38 60% 50% / 0.12), transparent 60%), radial-gradient(ellipse at 100% 100%, hsl(210 55% 50% / 0.06), transparent 55%)",
          }}
        />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            {plan.isActive && !plan.archived && (
              <Badge className="mb-3 gap-1 rounded-full border-0 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-3 w-3" />
                {t("activeBadge")}
              </Badge>
            )}
            <h1 className="font-display text-4xl leading-[1.05] text-foreground sm:text-5xl">
              {plan.name}
            </h1>
            {plan.description && (
              <p className="mt-3 max-w-prose text-sm text-muted-foreground sm:text-base">
                {plan.description}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {t("monthlyIncomeTotal")}
            </p>
            <p className="mt-1 font-display text-5xl tabular-nums text-foreground sm:text-6xl">
              {formatMoney(totalIncome)}
            </p>
          </div>
        </div>

        <div className="relative mt-10">
          <AllocationBar
            totalIncome={totalIncome}
            lines={plan.lines}
            allocatedBps={allocatedBps}
            overAllocated={overAllocated}
          />
        </div>
      </section>

      {/* Two-column editor */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <IncomeEditor planId={planId} incomes={plan.incomes} />
        <AllocationsEditor
          planId={planId}
          lines={plan.lines}
          incomes={plan.incomes}
          totalIncome={totalIncome}
          accounts={activeAccounts}
          allocatedBps={allBpsAllocated}
        />
      </div>

      <CreatePlanDialog
        open={editOpen}
        plan={planForEdit}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            void utils.incomePlan.get.invalidate({ id: planId });
          }
        }}
      />
    </div>
  );
}
