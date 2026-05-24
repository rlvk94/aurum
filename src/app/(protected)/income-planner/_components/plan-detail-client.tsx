"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, MoreHorizontal, Pencil, Sparkles } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/app/_components/badge";
import { Button } from "~/app/_components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import { usePageMetadata } from "~/app/_components/page-metadata";

import { AllocationBar } from "./allocation-bar";
import { AllocationsEditor } from "./allocations-editor";
import { CreatePlanDialog } from "./create-plan-dialog";
import { IncomeEditor } from "./income-editor";
import { bpsFromCents, formatMoney } from "../_lib/format";

type PlanFromList = RouterOutputs["incomePlan"]["list"][number];

export function PlanDetailClient({ planId }: { planId: string }) {
  const t = useTranslations("incomePlanner");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();
  const router = useRouter();

  const { data: plan } = api.incomePlan.get.useQuery({ id: planId });

  const [editOpen, setEditOpen] = useState(false);

  const setActive = api.incomePlan.setActive.useMutation({
    onSuccess: () => {
      void utils.incomePlan.get.invalidate({ id: planId });
      void utils.incomePlan.list.invalidate();
    },
  });

  const duplicatePlan = api.incomePlan.duplicate.useMutation({
    onSuccess: (created) => {
      void utils.incomePlan.list.invalidate();
      if (created) router.push(`/income-planner/${created.id}`);
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

  const planForEdit: PlanFromList = {
    ...plan,
    totalIncome,
    incomeCount: plan.incomes.length,
    allocationLineCount: plan.lines.length,
    allocatedPercentageBps: 0,
    allocatedFixedCents: 0,
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-6 shadow-elevated sm:px-10 sm:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 15% 0%, hsl(38 60% 50% / 0.12), transparent 60%), radial-gradient(ellipse at 100% 100%, hsl(210 55% 50% / 0.06), transparent 55%)",
          }}
        />

        {/* Action menu */}
        <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-background/70 backdrop-blur hover:bg-background"
                aria-label={tCommon("actions")}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil />
                {t("editPlan")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => duplicatePlan.mutate({ id: planId })}
              >
                <Copy />
                {t("duplicatePlan")}
              </DropdownMenuItem>
              {!plan.isActive && !plan.archived && (
                <DropdownMenuItem
                  onClick={() => setActive.mutate({ id: planId })}
                >
                  <Sparkles />
                  {t("setActive")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="relative flex flex-col gap-6 pr-12 lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:pr-14">
          <div className="min-w-0">
            {plan.isActive && !plan.archived && (
              <Badge className="mb-3 gap-1 rounded-full border-0 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-3 w-3" />
                {t("activeBadge")}
              </Badge>
            )}
            <h1 className="font-display text-3xl leading-[1.05] text-foreground sm:text-4xl lg:text-5xl">
              {plan.name}
            </h1>
            {plan.description && (
              <p className="mt-3 max-w-prose text-sm text-muted-foreground sm:text-base">
                {plan.description}
              </p>
            )}
          </div>
          <div className="text-left lg:text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {t("monthlyIncomeTotal")}
            </p>
            <p className="mt-1 font-display text-4xl tabular-nums text-foreground sm:text-5xl lg:text-6xl">
              {formatMoney(totalIncome)}
            </p>
          </div>
        </div>

        <div className="relative mt-8 sm:mt-10">
          <AllocationBar
            totalIncome={totalIncome}
            lines={plan.lines}
            allocatedBps={allocatedBps}
            overAllocated={overAllocated}
          />
        </div>
      </section>

      {/* Two-column editor */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <IncomeEditor planId={planId} incomes={plan.incomes} />
        <AllocationsEditor
          planId={planId}
          lines={plan.lines}
          incomes={plan.incomes}
          totalIncome={totalIncome}
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
