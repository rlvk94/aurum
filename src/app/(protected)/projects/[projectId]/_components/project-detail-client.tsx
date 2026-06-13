"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { format, parseISO } from "date-fns";
import { da, enUS } from "date-fns/locale";
import { Archive, Pencil, Plus, Trash2, ArrowRight, Link2 } from "lucide-react";
import posthog from "posthog-js";

import { api } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Badge } from "~/app/_components/badge";
import { usePageMetadata } from "~/app/_components/page-metadata";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/app/_components/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import { cn } from "~/app/_lib/utils";

import { ProjectCover } from "../../_components/project-cover";
import { ProjectFormDialog } from "../../_components/project-form-dialog";
import {
  deriveProgress,
  formatAmount,
  todayIso,
  type ProjectPalette,
  type ProjectStatus,
} from "../../_lib/format";

const STATUS_CLASSES: Record<ProjectStatus | "archived", string> = {
  no_dates: "bg-secondary text-secondary-foreground",
  not_started: "bg-secondary text-secondary-foreground",
  active: "bg-card text-foreground",
  ended: "bg-card text-muted-foreground",
  met: "bg-income text-income-foreground",
  over: "bg-expense text-expense-foreground",
  archived: "bg-muted text-muted-foreground",
};

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const tTransactions = useTranslations("transactions");
  const locale = useLocale();
  const dateLocale = locale === "da" ? da : enUS;
  const utils = api.useUtils();

  const { data: project } = api.project.get.useQuery({ id: projectId });
  const { data: categories = [] } = api.category.list.useQuery();
  const { data: accounts = [] } = api.financialAccount.list.useQuery();

  const [editing, setEditing] = useState(false);

  const setArchived = api.project.setArchived.useMutation({
    onSuccess: (_, variables) => {
      posthog.capture("project_archived", { archived: variables.archived });
      void utils.project.get.invalidate({ id: projectId });
      void utils.project.list.invalidate();
    },
  });
  const deleteProject = api.project.delete.useMutation({
    onSuccess: () => {
      void utils.project.list.invalidate();
      router.push("/projects");
    },
  });

  usePageMetadata(
    project ? { title: project.name, parentPath: "/projects" } : null,
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  if (!project) {
    return null;
  }

  const palette = project.coverPalette as ProjectPalette;
  const progress = deriveProgress({
    startDate: project.startDate,
    endDate: project.endDate,
    spendingLimit: project.spendingLimit,
    net: project.net,
  });
  const limitPct =
    progress.limitFraction !== null
      ? Math.min(100, Math.round(progress.limitFraction * 100))
      : null;
  const elapsedPct =
    progress.elapsedFraction !== null
      ? Math.min(100, Math.round(progress.elapsedFraction * 100))
      : null;
  const remaining = project.spendingLimit
    ? project.spendingLimit - project.net
    : null;

  const periodLabel =
    project.startDate && project.endDate
      ? `${format(parseISO(project.startDate), "d. MMM yyyy", { locale: dateLocale })} – ${format(parseISO(project.endDate), "d. MMM yyyy", { locale: dateLocale })}`
      : project.startDate
        ? format(parseISO(project.startDate), "d. MMM yyyy", {
            locale: dateLocale,
          })
        : project.endDate
          ? `→ ${format(parseISO(project.endDate), "d. MMM yyyy", { locale: dateLocale })}`
          : t("status.noDates");

  const handleDelete = () => {
    if (confirm(t("actions.deleteConfirm", { name: project.name }))) {
      deleteProject.mutate({ id: project.id });
    }
  };

  const totalCategorySpend = project.byCategory.reduce(
    (acc, c) => acc + (c.spent - c.received),
    0,
  );
  const totalAccountSpend = project.byAccount.reduce(
    (acc, a) => acc + (a.spent - a.received),
    0,
  );

  return (
    <div className="container mx-auto space-y-8">
      {/* Hero */}
      <div className="border-border shadow-elevated overflow-hidden rounded-2xl border">
        <ProjectCover palette={palette} emoji={project.emoji} size="hero">
          <div className="absolute top-6 right-6 z-20">
            <Badge
              className={cn(
                "rounded-full border-0 px-2.5 py-0.5 text-[10px] font-medium tracking-wider uppercase backdrop-blur",
                STATUS_CLASSES[
                  project.archivedAt ? "archived" : progress.status
                ],
              )}
            >
              {project.archivedAt
                ? t("status.archived")
                : t(`status.${progress.status}`)}
            </Badge>
          </div>
          <div className="absolute inset-x-6 bottom-6 z-20 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display truncate text-4xl text-[var(--cover-glyph)] sm:text-5xl">
                {project.name}
              </h1>
              <p className="mt-1 text-sm text-[var(--cover-glyph)] opacity-80">
                {periodLabel}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="bg-card/40 text-foreground hover:bg-card/70 relative z-30 h-9 rounded-full px-4 backdrop-blur"
                >
                  <Pencil className="h-4 w-4" />
                  <span>{tCommon("actions")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil />
                  {t("actions.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setArchived.mutate({
                      id: project.id,
                      archived: !project.archivedAt,
                    })
                  }
                >
                  <Archive />
                  {project.archivedAt
                    ? t("actions.unarchive")
                    : t("actions.archive")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 />
                  {t("actions.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ProjectCover>
      </div>

      {project.description && (
        <p className="text-muted-foreground max-w-3xl">{project.description}</p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={t("labels.spent")}
          value={formatAmount(project.spent)}
          tone="expense"
        />
        <KpiCard
          label={t("labels.received")}
          value={formatAmount(project.received)}
          tone="income"
        />
        <KpiCard
          label={t("labels.net")}
          value={formatAmount(project.net)}
          tone="default"
        />
        {project.spendingLimit ? (
          progress.status === "over" ? (
            <KpiCard
              label={t("labels.overBy", {
                amount: formatAmount(Math.abs(remaining ?? 0)),
              })}
              value={formatAmount(project.spendingLimit)}
              tone="expense"
            />
          ) : (
            <KpiCard
              label={t("labels.remaining")}
              value={formatAmount(remaining ?? 0)}
              tone={remaining !== null && remaining < 0 ? "expense" : "default"}
            />
          )
        ) : (
          <KpiCard
            label={t("card.noLimit")}
            value={t("labels.transactions", {
              count: project.transactionCount,
            })}
            tone="default"
          />
        )}
      </div>

      {/* Burndown lane */}
      {limitPct !== null && (
        <div className="border-border bg-card shadow-card rounded-2xl border p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-foreground text-sm font-medium">
              {t("labels.burndownLegend")}
            </p>
            <p className="text-muted-foreground text-xs">
              {progress.status === "active" && progress.daysLeft !== null
                ? t("labels.daysLeft", { count: progress.daysLeft })
                : progress.status === "not_started" &&
                    progress.daysToStart !== null
                  ? t("labels.startsIn", { count: progress.daysToStart })
                  : progress.status === "ended" &&
                      progress.daysSinceEnd !== null
                    ? t("labels.endedDaysAgo", { count: progress.daysSinceEnd })
                    : t(`status.${progress.status}`)}
            </p>
          </div>

          {/* Today caption row, aligned with the tick */}
          <div className="relative mb-1.5 h-4 text-[11px]">
            {elapsedPct !== null && (
              <div
                className="text-foreground absolute -translate-x-1/2 font-medium whitespace-nowrap"
                style={{ left: `${elapsedPct}%` }}
              >
                {format(parseISO(todayIso()), "d. MMM", { locale: dateLocale })}
              </div>
            )}
          </div>

          {/* Bar */}
          <div className="bg-muted relative h-2 overflow-hidden rounded-full">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progress.status === "over"
                  ? "bg-expense"
                  : progress.status === "met"
                    ? "bg-income"
                    : progress.isOnTrack === false
                      ? "bg-warning"
                      : "bg-primary",
              )}
              style={{ width: `${Math.min(100, limitPct)}%` }}
            />
            {elapsedPct !== null && (
              <span
                className="bg-foreground absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded"
                style={{ left: `${elapsedPct}%` }}
                aria-hidden
              />
            )}
          </div>

          {/* Date axis */}
          <div className="text-muted-foreground mt-1.5 flex items-center justify-between text-[11px]">
            <span>
              {project.startDate
                ? format(parseISO(project.startDate), "d. MMM yyyy", {
                    locale: dateLocale,
                  })
                : "—"}
            </span>
            <span>
              {project.endDate
                ? format(parseISO(project.endDate), "d. MMM yyyy", {
                    locale: dateLocale,
                  })
                : "—"}
            </span>
          </div>

          {/* Footer summary */}
          <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
            <span className="text-muted-foreground">
              {limitPct}% {t("labels.spent").toLowerCase()}
            </span>
            {progress.isOnTrack !== null && (
              <span
                className={cn(
                  "font-medium",
                  progress.isOnTrack ? "text-income" : "text-warning",
                )}
              >
                {progress.isOnTrack
                  ? t("labels.onTrack")
                  : t("labels.offTrack")}
              </span>
            )}
            {elapsedPct !== null && (
              <span className="text-muted-foreground">
                {elapsedPct}% {t("labels.timeElapsed")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Breakdowns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownCard
          heading={t("labels.byCategory")}
          rows={project.byCategory.map((c) => ({
            id: c.categoryId ?? "uncategorized",
            label: c.categoryId
              ? (categoryMap.get(c.categoryId)?.name ??
                t("labels.uncategorized"))
              : t("labels.uncategorized"),
            icon: c.categoryId ? categoryMap.get(c.categoryId)?.icon : null,
            spent: c.spent - c.received,
            count: c.count,
          }))}
          total={totalCategorySpend}
        />
        <BreakdownCard
          heading={t("labels.byAccount")}
          rows={project.byAccount.map((a) => ({
            id: a.accountId,
            label:
              accountMap.get(a.accountId)?.name ?? t("labels.untaggedAccount"),
            icon: null,
            spent: a.spent - a.received,
            count: a.count,
          }))}
          total={totalAccountSpend}
        />
      </div>

      {/* Recent transactions */}
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-foreground text-xl">
            {t("labels.recentTransactions")}
          </h2>
          {project.transactionCount > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link
                href={`/transactions?project=${project.id}`}
                className="gap-1 text-sm"
              >
                {t("labels.seeAll")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>

        {project.recentTransactions.length === 0 ? (
          <div className="border-border bg-card/50 rounded-xl border border-dashed p-8 text-center">
            <p className="text-muted-foreground text-sm">
              {t("labels.noTransactions")}
            </p>
            <Button asChild variant="outline" className="mt-4" size="sm">
              <Link href="/transactions?project=unassigned">
                <Plus />
                {t("labels.linkExisting")}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="border-border bg-card shadow-card overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("date")}</TableHead>
                  <TableHead>{tTransactions("descriptionLabel")}</TableHead>
                  <TableHead>{tCommon("category")}</TableHead>
                  <TableHead>{tTransactions("account")}</TableHead>
                  <TableHead className="text-right">
                    {tTransactions("amount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.recentTransactions.map((tx) => {
                  const cat = tx.categoryId
                    ? categoryMap.get(tx.categoryId)
                    : null;
                  const acc = accountMap.get(tx.accountId);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(parseISO(tx.date), "d. MMM yyyy", {
                          locale: dateLocale,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {tx.transferGroupId && (
                            <Link2 className="text-muted-foreground h-3.5 w-3.5" />
                          )}
                          <span className="text-foreground font-medium">
                            {tx.description}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {cat ? (
                          <span className="bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                            {cat.icon && <span>{cat.icon}</span>}
                            {cat.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {t("labels.uncategorized")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {acc?.name ?? "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium whitespace-nowrap",
                          tx.type === "expense" && "text-expense",
                          tx.type === "income" && "text-income",
                        )}
                      >
                        {tx.type === "expense" ? "-" : "+"}
                        {formatAmount(tx.amount, { decimals: 2 })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ProjectFormDialog
        open={editing}
        onOpenChange={setEditing}
        project={project}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "income" | "expense";
}) {
  return (
    <div className="border-border bg-card shadow-card rounded-xl border p-4">
      <p className="text-muted-foreground text-xs tracking-wider uppercase">
        {label}
      </p>
      <p
        className={cn(
          "font-display mt-2 text-2xl",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function BreakdownCard({
  heading,
  rows,
  total,
}: {
  heading: string;
  rows: {
    id: string;
    label: string;
    icon?: string | null;
    spent: number;
    count: number;
  }[];
  total: number;
}) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.spent)));
  const sorted = [...rows].sort(
    (a, b) => Math.abs(b.spent) - Math.abs(a.spent),
  );
  const t = useTranslations("projects");

  return (
    <div className="border-border bg-card shadow-card rounded-xl border p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-foreground text-lg">{heading}</h3>
        <span className="text-muted-foreground text-xs">
          {t("labels.transactions", {
            count: rows.reduce((acc, r) => acc + r.count, 0),
          })}
        </span>
      </div>
      {sorted.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("labels.noTransactions")}
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((r) => {
            const pct = (Math.abs(r.spent) / max) * 100;
            return (
              <li key={r.id} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {r.icon && <span>{r.icon}</span>}
                    <span className="text-foreground truncate">{r.label}</span>
                  </span>
                  <span className="text-foreground font-medium whitespace-nowrap">
                    {formatAmount(r.spent)}
                  </span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      r.spent < 0 ? "bg-income" : "bg-primary/70",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {total !== 0 && (
        <div className="border-border text-muted-foreground mt-4 flex items-center justify-between border-t pt-3 text-xs">
          <span>{t("labels.net")}</span>
          <span className="text-foreground font-medium">
            {formatAmount(total)}
          </span>
        </div>
      )}
    </div>
  );
}
