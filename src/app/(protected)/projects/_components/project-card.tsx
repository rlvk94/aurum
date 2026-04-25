"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { format, parseISO } from "date-fns";
import { da, enUS } from "date-fns/locale";
import { Archive, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/app/_components/badge";
import { Button } from "~/app/_components/button";
import { Card } from "~/app/_components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import { cn } from "~/app/_lib/utils";

import { ProjectCover } from "./project-cover";
import {
  deriveProgress,
  formatAmount,
  type ProjectPalette,
  type ProjectStatus,
} from "../_lib/format";

type Project = RouterOutputs["project"]["list"][number];
type Category = RouterOutputs["category"]["list"][number];

const STATUS_CLASSES: Record<ProjectStatus | "archived", string> = {
  no_dates: "bg-secondary text-secondary-foreground",
  not_started: "bg-secondary text-secondary-foreground",
  active: "bg-card/95 text-foreground",
  ended: "bg-card/90 text-muted-foreground",
  met: "bg-income text-income-foreground",
  over: "bg-expense text-expense-foreground",
  archived: "bg-muted text-muted-foreground",
};

export function ProjectCard({
  project,
  categories,
  onEdit,
  onArchiveToggle,
  onDelete,
}: {
  project: Project;
  categories: Category[];
  onEdit: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dateLocale = locale === "da" ? da : enUS;

  const archived = !!project.archivedAt;
  const palette = project.coverPalette as ProjectPalette;
  const progress = deriveProgress({
    startDate: project.startDate,
    endDate: project.endDate,
    spendingLimit: project.spendingLimit,
    net: project.net,
  });

  const limit = project.spendingLimit;
  const limitPct =
    progress.limitFraction !== null
      ? Math.min(100, Math.round(progress.limitFraction * 100))
      : null;

  const remaining = limit !== null && limit !== undefined ? limit - project.net : null;
  const overBy = remaining !== null && remaining < 0 ? Math.abs(remaining) : 0;

  const barColor =
    progress.status === "over"
      ? "bg-expense"
      : progress.status === "met"
        ? "bg-income"
        : progress.isOnTrack === false
          ? "bg-warning"
          : "bg-primary";

  const periodLabel = formatPeriod(project.startDate, project.endDate, dateLocale);

  const topCats = (project.topCategoryIds ?? [])
    .map((id) => categories.find((c) => c.id === id))
    .filter(Boolean) as Category[];

  const statusKey = archived ? "archived" : progress.status;
  const statusLabelKey = `status.${statusKey}` as const;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border bg-card shadow-card transition hover:shadow-elevated",
        archived && "opacity-60",
      )}
    >
      <div className="absolute right-3 top-3 z-30">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("card.moreOptions")}
              className="h-7 w-7 rounded-full bg-card/40 text-foreground backdrop-blur hover:bg-card/70"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil />
              {t("actions.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchiveToggle}>
              <Archive />
              {archived ? t("actions.unarchive") : t("actions.archive")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={onDelete}
            >
              <Trash2 />
              {t("actions.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Link
        href={`/projects/${project.id}`}
        aria-label={t("card.openProject")}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ProjectCover palette={palette} emoji={project.emoji} size="md">
          <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3">
            <p className="min-w-0 flex-1 truncate font-display text-xl text-[var(--cover-glyph)]">
              {project.name}
            </p>
            <Badge
              className={cn(
                "shrink-0 rounded-full border-0 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider backdrop-blur",
                STATUS_CLASSES[statusKey],
              )}
            >
              {t(statusLabelKey)}
            </Badge>
          </div>
        </ProjectCover>

        <div className="space-y-4 p-5">
          <p className="text-xs text-muted-foreground">
            {periodLabel ?? t("status.noDates")}
            {project.transactionCount > 0 && (
              <>
                {" · "}
                {t("labels.transactions", {
                  count: project.transactionCount,
                })}
              </>
            )}
          </p>

          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl text-foreground">
                {formatAmount(project.net)}
              </span>
              {limit ? (
                <span className="text-sm text-muted-foreground">
                  {t("labels.ofLimit", { limit: formatAmount(limit) })}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {t("card.noLimit")}
                </span>
              )}
            </div>
            {project.received > 0 && (
              <p className="text-xs text-muted-foreground">
                {tCommon("currency")}{" "}
                <span className="text-income">
                  +{formatAmount(project.received)}
                </span>{" "}
                {t("labels.received").toLowerCase()}
              </p>
            )}
          </div>

          {limitPct !== null && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {progress.status === "over"
                    ? t("labels.overBy", { amount: formatAmount(overBy) })
                    : remaining !== null
                      ? `${formatAmount(remaining)} ${t("labels.remaining").toLowerCase()}`
                      : ""}
                </span>
                <span className="font-medium text-foreground">{limitPct}%</span>
              </div>
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", barColor)}
                  style={{ width: `${Math.min(100, limitPct)}%` }}
                />
                {progress.elapsedFraction !== null && (
                  <span
                    className="absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-foreground/40"
                    style={{
                      left: `${Math.min(100, Math.round(progress.elapsedFraction * 100))}%`,
                    }}
                    aria-hidden
                  />
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {progress.status === "active" && progress.daysLeft !== null
                  ? t("labels.daysLeft", { count: progress.daysLeft })
                  : progress.status === "not_started" &&
                      progress.daysToStart !== null
                    ? t("labels.startsIn", { count: progress.daysToStart })
                    : progress.status === "ended" &&
                        progress.daysSinceEnd !== null
                      ? t("labels.endedDaysAgo", {
                          count: progress.daysSinceEnd,
                        })
                      : null}
              </p>
            </div>
          )}

          {topCats.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {topCats.slice(0, 3).map((c) => (
                <Badge key={c.id} variant="secondary" className="font-normal">
                  {c.icon && <span className="mr-1">{c.icon}</span>}
                  {c.name}
                </Badge>
              ))}
              {topCats.length > 3 && (
                <Badge variant="outline" className="font-normal">
                  +{topCats.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      </Link>
    </Card>
  );
}

function formatPeriod(
  startDate: string | null,
  endDate: string | null,
  locale: typeof da,
) {
  if (!startDate && !endDate) return null;
  if (startDate && endDate) {
    return `${format(parseISO(startDate), "d. MMM", { locale })} – ${format(parseISO(endDate), "d. MMM yyyy", { locale })}`;
  }
  if (startDate) return format(parseISO(startDate), "d. MMM yyyy", { locale });
  if (endDate)
    return `→ ${format(parseISO(endDate), "d. MMM yyyy", { locale })}`;
  return null;
}
