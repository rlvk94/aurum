"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Archive,
  ArchiveRestore,
  Calculator,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { PageHeader } from "~/app/_components/page-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";

import { CreatePlanDialog } from "./create-plan-dialog";
import { PlanCard } from "./plan-card";

type Plan = RouterOutputs["incomePlan"]["list"][number];

export function PlanListClient() {
  const t = useTranslations("incomePlanner");
  const utils = api.useUtils();

  const { data: plans } = api.incomePlan.list.useQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const updatePlan = api.incomePlan.update.useMutation({
    onSuccess: () => void utils.incomePlan.list.invalidate(),
  });
  const setActive = api.incomePlan.setActive.useMutation({
    onSuccess: () => void utils.incomePlan.list.invalidate(),
  });
  const deletePlan = api.incomePlan.delete.useMutation({
    onSuccess: () => void utils.incomePlan.list.invalidate(),
  });

  const active = plans?.find((p) => p.isActive && !p.archived) ?? null;
  const others = (plans ?? []).filter((p) => p !== active && !p.archived);
  const archived = (plans ?? []).filter((p) => p.archived);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("createPlan")}
          </Button>
        }
      />

      {!plans || plans.length === 0 ? (
        <EditorialEmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {active && (
            <section>
              <SectionHeading
                eyebrow={t("activePlan")}
                count={null}
              />
              <div className="mt-4">
                <PlanCardWithMenu
                  plan={active}
                  variant="hero"
                  onEdit={() => setEditingPlan(active)}
                  onSetActive={() => setActive.mutate({ id: active.id })}
                  onArchive={() =>
                    updatePlan.mutate({ id: active.id, archived: true })
                  }
                  onDelete={() => {
                    if (confirm(t("confirmDeletePlan", { name: active.name }))) {
                      deletePlan.mutate({ id: active.id });
                    }
                  }}
                />
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section>
              <SectionHeading
                eyebrow={t("otherPlans")}
                count={others.length}
              />
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((plan) => (
                  <PlanCardWithMenu
                    key={plan.id}
                    plan={plan}
                    onEdit={() => setEditingPlan(plan)}
                    onSetActive={() => setActive.mutate({ id: plan.id })}
                    onArchive={() =>
                      updatePlan.mutate({ id: plan.id, archived: true })
                    }
                    onDelete={() => {
                      if (confirm(t("confirmDeletePlan", { name: plan.name }))) {
                        deletePlan.mutate({ id: plan.id });
                      }
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {archived.length > 0 && (
            <section>
              <SectionHeading
                eyebrow={t("archivedPlans")}
                count={archived.length}
              />
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map((plan) => (
                  <PlanCardWithMenu
                    key={plan.id}
                    plan={plan}
                    archived
                    onEdit={() => setEditingPlan(plan)}
                    onSetActive={() => setActive.mutate({ id: plan.id })}
                    onArchive={() =>
                      updatePlan.mutate({ id: plan.id, archived: false })
                    }
                    onDelete={() => {
                      if (confirm(t("confirmDeletePlan", { name: plan.name }))) {
                        deletePlan.mutate({ id: plan.id });
                      }
                    }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <CreatePlanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <CreatePlanDialog
        key={editingPlan?.id}
        open={Boolean(editingPlan)}
        plan={editingPlan ?? undefined}
        onOpenChange={(open) => !open && setEditingPlan(null)}
      />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  count,
}: {
  eyebrow: string;
  count: number | null;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="font-sans text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
        {count !== null && (
          <span className="ml-2 tabular-nums text-foreground/70">
            {String(count).padStart(2, "0")}
          </span>
        )}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function PlanCardWithMenu({
  plan,
  variant = "compact",
  archived = false,
  onEdit,
  onSetActive,
  onArchive,
  onDelete,
}: {
  plan: Plan;
  variant?: "hero" | "compact";
  archived?: boolean;
  onEdit: () => void;
  onSetActive: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("incomePlanner");
  const tCommon = useTranslations("common");

  return (
    <div className="relative">
      <PlanCard plan={plan} variant={variant} archived={archived} />
      <div className="absolute right-3 top-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-background/60 backdrop-blur"
              aria-label={tCommon("actions")}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil />
              {t("editPlan")}
            </DropdownMenuItem>
            {!plan.isActive && !archived && (
              <DropdownMenuItem onClick={onSetActive}>
                <CheckCircle2 />
                {t("setActive")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onArchive}>
              {archived ? <ArchiveRestore /> : <Archive />}
              {archived ? t("unarchivePlan") : t("archivePlan")}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 />
              {t("deletePlan")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function EditorialEmptyState({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("incomePlanner");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-8 py-16 text-center shadow-card sm:px-16 sm:py-24">
      {/* Soft radial wash behind the content */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at top, hsl(38 60% 50% / 0.08), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Calculator className="h-6 w-6" />
        </div>
        <h2 className="mt-6 font-display text-3xl leading-tight text-foreground sm:text-4xl">
          {t("emptyState")}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          {t("subtitle")}
        </p>
        <Button className="mt-8" size="lg" onClick={onCreate}>
          <Sparkles />
          {t("createPlan")}
        </Button>
      </div>
    </div>
  );
}
