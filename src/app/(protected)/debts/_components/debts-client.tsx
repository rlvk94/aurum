"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Archive,
  CreditCard,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { PERIOD_MONTHS } from "~/server/lib/amortization";
import { PageHeader } from "~/app/_components/page-header";
import { FamilyFeatureTeaser } from "~/app/_components/billing/family-feature-teaser";
import { useEntitlements } from "~/app/_hooks/use-entitlements";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";
import { Badge } from "~/app/_components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import { DebtFormDialog } from "./debt-form-dialog";

type Debt = RouterOutputs["debt"]["list"][number];

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} kr.`;
}

function DebtCard({
  debt,
  onEdit,
  onArchiveToggle,
  onDelete,
}: {
  debt: Debt;
  onEdit: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("debts");
  const tCommon = useTranslations("common");

  const { summary } = debt;
  const archived = Boolean(debt.archivedAt);
  const paidOff = summary.outstandingBalance === 0;
  const progressPct = Math.round(summary.progress * 100);
  const periodsRemaining = Math.max(
    0,
    summary.numberOfPayments - summary.paymentsMade,
  );
  const monthsRemaining =
    periodsRemaining * PERIOD_MONTHS[debt.paymentFrequency];

  return (
    <Card className={archived ? "opacity-60" : ""}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
            <CreditCard className="h-5 w-5 text-debt" />
          </div>
          <div className="min-w-0">
            <Link
              href={`/debts/${debt.id}`}
              className="truncate font-medium text-foreground hover:underline"
            >
              {debt.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {debt.lender}
              {debt.assetName ? ` · ${debt.assetName}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {paidOff && (
            <Badge variant="secondary" className="shrink-0">
              {t("paidOff")}
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil />
                {tCommon("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchiveToggle}>
                <Archive />
                {archived ? t("unarchive") : t("archive")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={onDelete}
              >
                <Trash2 />
                {tCommon("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">{t("currentBalance")}</p>
          <p className="font-display text-2xl text-foreground">
            {formatAmount(summary.outstandingBalance)}
          </p>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("progress")}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
          <div>
            <p className="text-muted-foreground">
              {t(`paymentPerFrequency.${debt.paymentFrequency}`)}
            </p>
            <p className="font-medium text-foreground">
              {formatAmount(summary.periodicPayment)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("paymentsRemaining")}</p>
            <p className="font-medium text-foreground">
              {t("monthsRemaining", { count: monthsRemaining })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DebtsClient() {
  const t = useTranslations("debts");
  const tTeaser = useTranslations("billing.featureCopy.debts");
  const utils = api.useUtils();
  const { has } = useEntitlements();

  const { data: debts, isLoading } = api.debt.list.useQuery(undefined, {
    enabled: has("debts"),
  });
  const { data: summary } = api.debt.summary.useQuery(undefined, {
    enabled: has("debts"),
  });

  if (!has("debts")) {
    let bullets: string[] = [];
    try {
      bullets = (tTeaser.raw("bullets") as string[]) ?? [];
    } catch {
      bullets = [];
    }
    return <FamilyFeatureTeaser feature="debts" bullets={bullets} />;
  }

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);

  const invalidateAll = () => {
    void utils.debt.list.invalidate();
    void utils.debt.summary.invalidate();
    void utils.asset.list.invalidate();
  };

  const setArchived = api.debt.setArchived.useMutation({
    onSuccess: invalidateAll,
  });
  const deleteDebt = api.debt.delete.useMutation({
    onSuccess: invalidateAll,
  });

  if (isLoading) return null;

  const active = debts?.filter((d) => !d.archivedAt) ?? [];
  const archived = debts?.filter((d) => d.archivedAt) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("addDebt")}
          </Button>
        }
      />

      {debts && debts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("totalDebt")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl text-debt">
                {summary ? formatAmount(summary.totalOutstanding) : "–"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("totalMonthlyEquivalent")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl">
                {summary
                  ? formatAmount(summary.totalMonthlyEquivalent)
                  : "–"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!debts || debts.length === 0 ? (
        <EmptyState icon={CreditCard} message={t("emptyState")} />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((d) => (
                <DebtCard
                  key={d.id}
                  debt={d}
                  onEdit={() => setEditing(d)}
                  onArchiveToggle={() =>
                    setArchived.mutate({ id: d.id, archived: true })
                  }
                  onDelete={() => deleteDebt.mutate({ id: d.id })}
                />
              ))}
            </div>
          )}
          {archived.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                {t("archived")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map((d) => (
                  <DebtCard
                    key={d.id}
                    debt={d}
                    onEdit={() => setEditing(d)}
                    onArchiveToggle={() =>
                      setArchived.mutate({ id: d.id, archived: false })
                    }
                    onDelete={() => deleteDebt.mutate({ id: d.id })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <DebtFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <DebtFormDialog
        key={editing?.id}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        debt={editing ?? undefined}
      />
    </div>
  );
}
