"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import posthog from "posthog-js";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  ClipboardPen,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { usePageMetadata } from "~/app/_components/page-metadata";
import { PageHeader } from "~/app/_components/page-header";
import { Badge } from "~/app/_components/badge";
import { Button } from "~/app/_components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import { Skeleton } from "~/app/_components/skeleton";
import { cn } from "~/app/_lib/utils";
import {
  formatChangePct,
  formatDelta,
  formatQuantity,
  formatReadingDate,
  formatUnit,
  perDayDecimals,
} from "../../_lib/format";
import { MeterIcon, meterTint } from "../../_lib/meter-icons";
import { MeterFormDialog } from "../../_components/meter-form-dialog";
import { ReadMetersDialog } from "../../_components/read-meters-dialog";
import { ReadingFormDialog } from "./reading-form-dialog";
import { ReadingsTable } from "./readings-table";
import { YearGrid } from "./year-grid";
import { YoyChart } from "./yoy-chart";

type MeterDetail = RouterOutputs["consumption"]["getMeter"];
type Reading = MeterDetail["readings"][number];

export function MeterDetailClient({ id }: { id: string }) {
  const t = useTranslations("consumption");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const utils = api.useUtils();

  const { data: meter, isLoading } = api.consumption.getMeter.useQuery({ id });

  usePageMetadata(
    meter ? { title: meter.name, parentPath: "/consumption" } : null,
  );

  const [readOpen, setReadOpen] = useState(false);
  const [editMeterOpen, setEditMeterOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<Reading | null>(null);

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const [cursorYear, setCursorYear] = useState(currentYear);

  const invalidate = () => {
    void utils.consumption.getMeter.invalidate({ id });
    void utils.consumption.listMeters.invalidate();
    void utils.consumption.summary.invalidate();
  };

  const setArchived = api.consumption.setMeterArchived.useMutation({
    onSuccess: (_, vars) => {
      posthog.capture("consumption_meter_archived", {
        archived: vars.archived,
      });
      invalidate();
    },
  });
  const deleteMeter = api.consumption.deleteMeter.useMutation({
    onSuccess: () => {
      posthog.capture("consumption_meter_deleted");
      void utils.consumption.listMeters.invalidate();
      void utils.consumption.summary.invalidate();
      router.push("/consumption");
    },
  });
  const deleteReading = api.consumption.deleteReading.useMutation({
    onSuccess: () => {
      posthog.capture("consumption_reading_deleted");
      invalidate();
    },
    onError: (e) => {
      alert(
        e.message === "delete_breaks_sequence"
          ? t("validation.deleteBreaksSequence")
          : tCommon("error"),
      );
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!meter) return null;

  const unit = formatUnit(meter.unit);
  const yearKeys = Object.keys(meter.months).map(Number);
  const minYear = yearKeys.length ? Math.min(...yearKeys) : currentYear;
  const maxYear = yearKeys.length ? Math.max(...yearKeys) : currentYear;
  const year = Math.min(Math.max(cursorYear, minYear), maxYear);
  const emptyYear = Array.from({ length: 12 }, (_, i) => ({
    year,
    month: i + 1,
    daysInMonth: new Date(year, i + 1, 0).getDate(),
    coveredDays: 0,
    unknownDays: 0,
    coverage: 0,
    isComplete: false,
    consumption: null,
  }));
  const currentMonths = meter.months[year] ?? emptyYear;
  const previousMonths = meter.months[year - 1];
  const yearSummary = meter.years.find((y) => y.year === year);
  const prevSummary = meter.years.find((y) => y.year === year - 1);
  const changePct =
    yearSummary?.changeVsPreviousYearBps != null
      ? yearSummary.changeVsPreviousYearBps / 100
      : null;
  const currentMonthIndex = year === currentYear ? now.getMonth() : null;
  const { latestReading, lastInterval } = meter;

  return (
    <div className="space-y-6">
      <PageHeader
        title={meter.name}
        description={`${t(`kinds.${meter.kind as "electricity"}`)}${unit ? ` · ${unit}` : ""}`}
        actions={
          <>
            {meter.isOverdue && !meter.archived && (
              <Badge
                variant="outline"
                className="border-warning/40 text-warning self-center whitespace-nowrap"
              >
                {t("overdue")}
              </Badge>
            )}
            <Button onClick={() => setReadOpen(true)} disabled={meter.archived}>
              <ClipboardPen />
              {t("readMeters")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={tCommon("more")}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditMeterOpen(true)}>
                  <Pencil />
                  {t("detail.editMeter")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setArchived.mutate({
                      id: meter.id,
                      archived: !meter.archived,
                    })
                  }
                >
                  {meter.archived ? <ArchiveRestore /> : <Archive />}
                  {meter.archived ? t("unarchive") : t("archive")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => {
                    if (
                      confirm(t("deleteMeterConfirm", { name: meter.name }))
                    ) {
                      deleteMeter.mutate({ id: meter.id });
                    }
                  }}
                >
                  <Trash2 />
                  {t("deleteMeter")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={
            <MeterIcon
              kind={meter.kind}
              className={cn("h-4 w-4", meterTint(meter.kind))}
            />
          }
          label={t("latestReading")}
          value={
            latestReading
              ? formatQuantity(latestReading.value, meter.decimals, meter.unit)
              : "—"
          }
          sub={
            latestReading
              ? formatReadingDate(latestReading.date, locale)
              : t("noReadingsYet")
          }
        />
        <StatCard
          label={t("lastInterval")}
          value={
            lastInterval
              ? formatDelta(
                  lastInterval.consumption,
                  meter.decimals,
                  meter.unit,
                )
              : "—"
          }
          sub={
            lastInterval
              ? `${t("days", { count: lastInterval.days })}${
                  lastInterval.perDay !== null
                    ? ` · ${formatQuantity(Math.round(lastInterval.perDay), perDayDecimals(meter.decimals), meter.unit)}/${t("dayAbbr")}`
                    : ""
                }`
              : undefined
          }
        />
        <StatCard
          label={`${t("thisYear")} ${year}`}
          value={
            yearSummary
              ? formatQuantity(yearSummary.total, meter.decimals, meter.unit)
              : "—"
          }
          sub={
            yearSummary
              ? t("completeMonths", { count: yearSummary.completeMonths })
              : undefined
          }
        />
        <StatCard
          label={t("vsLastYear")}
          value={formatChangePct(changePct)}
          tone={
            changePct === null
              ? "default"
              : changePct < 0
                ? "income"
                : changePct > 0
                  ? "expense"
                  : "default"
          }
          sub={
            prevSummary
              ? `${year - 1}: ${formatQuantity(prevSummary.total, meter.decimals, meter.unit)}`
              : undefined
          }
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{t("detail.yoyTitle")}</CardTitle>
            <CardDescription>
              {t("detail.yoyDescription", { year, previousYear: year - 1 })}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t("detail.previousYear")}
              disabled={year <= minYear}
              onClick={() => setCursorYear(year - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-display w-14 text-center tabular-nums">
              {year}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t("detail.nextYear")}
              disabled={year >= maxYear}
              onClick={() => setCursorYear(year + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <YoyChart
            current={currentMonths}
            previous={previousMonths}
            year={year}
            decimals={meter.decimals}
            unit={meter.unit}
            currentMonthIndex={currentMonthIndex}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("detail.gridTitle")}</CardTitle>
          <CardDescription>{t("detail.gridDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <YearGrid
            months={meter.months}
            years={meter.years}
            decimals={meter.decimals}
            unit={unit}
            currentYear={currentYear}
            currentMonthIndex={now.getMonth()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">{t("detail.readingsTitle")}</CardTitle>
          <Badge variant="secondary">{meter.readings.length}</Badge>
        </CardHeader>
        <CardContent>
          <ReadingsTable
            rows={meter.readings}
            decimals={meter.decimals}
            unit={meter.unit}
            onEdit={setEditingReading}
            onDelete={(r) => {
              if (confirm(t("deleteReadingConfirm"))) {
                deleteReading.mutate({ id: r.id });
              }
            }}
          />
        </CardContent>
      </Card>

      <ReadMetersDialog open={readOpen} onOpenChange={setReadOpen} />
      <MeterFormDialog
        key={`${meter.id}-${meter.updatedAt.toString()}`}
        open={editMeterOpen}
        onOpenChange={setEditMeterOpen}
        meter={meter}
      />
      <ReadingFormDialog
        key={editingReading?.id ?? "reading"}
        open={Boolean(editingReading)}
        onOpenChange={(open) => !open && setEditingReading(null)}
        reading={editingReading}
        meterId={meter.id}
        decimals={meter.decimals}
        unit={meter.unit}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "income" | "expense";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          {icon}
          <span>{label}</span>
        </div>
        <p
          className={cn(
            "font-display mt-2 truncate text-2xl leading-tight tabular-nums",
            tone === "income" && "text-income",
            tone === "expense" && "text-expense",
          )}
        >
          {value}
        </p>
        {sub && (
          <p className="text-muted-foreground mt-1 truncate text-xs">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}
