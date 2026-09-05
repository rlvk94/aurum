"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import posthog from "posthog-js";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Gauge } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { useIsMobile } from "~/app/_hooks/use-mobile";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { Switch } from "~/app/_components/switch";
import { Skeleton } from "~/app/_components/skeleton";
import { DatePicker } from "~/app/_components/date-picker";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "~/app/_components/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "~/app/_components/drawer";
import { cn } from "~/app/_lib/utils";
import {
  formatDelta,
  formatQuantity,
  formatReadingDate,
  formatUnit,
  parseQuantityInput,
  perDayDecimals,
} from "../_lib/format";
import { MeterIcon, meterTint } from "../_lib/meter-icons";

type MeterListItem = RouterOutputs["consumption"]["listMeters"][number];

type Entry = { value: string; isMeterReset: boolean };
const EMPTY_ENTRY: Entry = { value: "", isMeterReset: false };

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

type Baseline =
  | { kind: "none" }
  | { kind: "latest"; reading: { date: string; value: number } }
  | { kind: "overwrite"; reading: { date: string; value: number } | null }
  | { kind: "older" };

// Which existing reading the new value is compared against for a chosen date.
function baselineFor(item: MeterListItem, dateIso: string): Baseline {
  const { latestReading, previousReading } = item;
  if (!latestReading) return { kind: "none" };
  if (dateIso > latestReading.date)
    return { kind: "latest", reading: latestReading };
  if (dateIso === latestReading.date) {
    return { kind: "overwrite", reading: previousReading };
  }
  return { kind: "older" };
}

/**
 * The "Aflæs målere" flow: one date, one value per active meter, one bulk
 * mutation. Self-contained so the list page, the detail page and the dashboard
 * can all mount it. Dialog on desktop, bottom drawer on mobile.
 */
export function ReadMetersDialog({
  open,
  onOpenChange,
  onCreateMeter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateMeter?: () => void;
}) {
  const t = useTranslations("consumption");
  const isMobile = useIsMobile();

  const { data } = api.consumption.listMeters.useQuery(undefined, {
    enabled: open,
  });
  const active = useMemo(() => (data ?? []).filter((m) => !m.archived), [data]);

  const title = t("readDialog.title");
  const description = t("readDialog.description");

  let body: ReactNode;
  if (!data) {
    body = (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  } else if (active.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Gauge className="text-muted-foreground h-8 w-8" />
        <p className="text-muted-foreground text-sm">
          {t("readDialog.noMeters")}
        </p>
        {onCreateMeter ? (
          <Button onClick={onCreateMeter}>{t("createFirstMeter")}</Button>
        ) : (
          <Button asChild>
            <Link href="/consumption">{t("createFirstMeter")}</Link>
          </Button>
        )}
      </div>
    );
  } else {
    body = (
      <ReadMetersForm
        key={open ? "open" : "closed"}
        meters={active}
        onDone={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
      />
    );
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function ReadMetersForm({
  meters,
  onDone,
  onCancel,
}: {
  meters: MeterListItem[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("consumption");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const locale = useLocale();
  const utils = api.useUtils();

  const [date, setDate] = useState<string>(todayIso());
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(meters.map((m) => [m.id, EMPTY_ENTRY])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dateError, setDateError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const bulk = api.consumption.bulkUpsertReadings.useMutation({
    onSuccess: (_, vars) => {
      posthog.capture("consumption_readings_recorded", {
        meter_count: vars.rows.length,
        has_reset: vars.rows.some((r) => r.isMeterReset),
      });
      void utils.consumption.listMeters.invalidate();
      void utils.consumption.getMeter.invalidate();
      void utils.consumption.summary.invalidate();
      onDone();
    },
    onError: (e) => {
      const cause = (
        e.data as { cause?: { failures?: { meterId: string }[] } } | undefined
      )?.cause;
      if (e.message === "bulk_validation_failed" && cause?.failures) {
        const next: Record<string, string> = {};
        for (const f of cause.failures) {
          next[f.meterId] = t("validation.belowPreviousGeneric");
        }
        setErrors(next);
        return;
      }
      setFormError(tCommon("error"));
    },
  });

  const setEntry = (meterId: string, patch: Partial<Entry>) => {
    setEntries((prev) => ({
      ...prev,
      [meterId]: { ...(prev[meterId] ?? EMPTY_ENTRY), ...patch },
    }));
    if (errors[meterId]) {
      setErrors((prev) => {
        const { [meterId]: _omit, ...rest } = prev;
        return rest;
      });
    }
  };

  const submit = () => {
    setFormError(null);
    const nextErrors: Record<string, string> = {};
    let nextDateError: string | null = null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      nextDateError = tValidation("required");
    else if (date > todayIso()) nextDateError = t("validation.dateInFuture");

    const rows: { meterId: string; value: number; isMeterReset: boolean }[] =
      [];
    for (const m of meters) {
      const entry = entries[m.id] ?? EMPTY_ENTRY;
      if (entry.value.trim() === "") continue;
      const parsed = parseQuantityInput(entry.value);
      if (parsed === null) {
        nextErrors[m.id] = tValidation("invalid");
        continue;
      }
      if (parsed < 0) {
        nextErrors[m.id] = tValidation("positiveNumber");
        continue;
      }
      const baseline = baselineFor(m, date);
      if (baseline.kind === "older") {
        nextErrors[m.id] = t("validation.newerReadingExists", {
          date: formatReadingDate(m.latestReading!.date, locale),
        });
        continue;
      }
      const ref = baseline.kind === "none" ? null : baseline.reading;
      if (ref && !entry.isMeterReset && parsed < ref.value) {
        nextErrors[m.id] = t("validation.belowPrevious", {
          previous: formatQuantity(ref.value, m.decimals, m.unit),
        });
        continue;
      }
      rows.push({
        meterId: m.id,
        value: parsed,
        isMeterReset: entry.isMeterReset,
      });
    }

    if (rows.length === 0 && Object.keys(nextErrors).length === 0) {
      setFormError(t("validation.atLeastOne"));
    }
    setErrors(nextErrors);
    setDateError(nextDateError);
    if (
      nextDateError ||
      Object.keys(nextErrors).length > 0 ||
      rows.length === 0
    ) {
      return;
    }
    bulk.mutate({ date, rows });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <Field data-invalid={Boolean(dateError)}>
        <FieldLabel htmlFor="read-date">{t("readDialog.date")}</FieldLabel>
        <DatePicker
          id="read-date"
          value={date}
          onChange={(iso) => {
            setDate(iso);
            setDateError(null);
          }}
          maxYear={new Date().getFullYear()}
          aria-invalid={Boolean(dateError)}
        />
        {dateError && <FieldError errors={[{ message: dateError }]} />}
      </Field>

      <div className="space-y-3">
        {meters.map((m, index) => (
          <MeterRow
            key={m.id}
            item={m}
            date={date}
            entry={entries[m.id] ?? EMPTY_ENTRY}
            error={errors[m.id]}
            autoFocus={index === 0}
            onChange={(patch) => setEntry(m.id, patch)}
          />
        ))}
      </div>

      {formError && <p className="text-destructive text-sm">{formError}</p>}

      <DialogFooter className="mt-2 gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {tCommon("cancel")}
        </Button>
        <Button type="submit" disabled={bulk.isPending}>
          {bulk.isPending ? tCommon("loading") : t("readDialog.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function MeterRow({
  item,
  date,
  entry,
  error,
  autoFocus,
  onChange,
}: {
  item: MeterListItem;
  date: string;
  entry: Entry;
  error?: string;
  autoFocus: boolean;
  onChange: (patch: Partial<Entry>) => void;
}) {
  const t = useTranslations("consumption");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const unit = formatUnit(item.unit);

  const baseline = baselineFor(item, date);
  const ref =
    baseline.kind === "latest" || baseline.kind === "overwrite"
      ? baseline.reading
      : null;

  const parsed = entry.value.trim() ? parseQuantityInput(entry.value) : null;
  let deltaLine: string | null = null;
  let deltaNegative = false;
  if (parsed !== null && ref && !entry.isMeterReset) {
    const delta = parsed - ref.value;
    const days = differenceInCalendarDays(parseISO(date), parseISO(ref.date));
    deltaNegative = delta < 0;
    const perDay =
      days > 0
        ? formatQuantity(
            Math.round(delta / days),
            perDayDecimals(item.decimals),
            item.unit,
          )
        : null;
    deltaLine = `Δ ${formatDelta(delta, item.decimals, item.unit)} · ${t("days", { count: days })}${perDay ? ` · ${perDay}/${t("dayAbbr")}` : ""}`;
  } else if (parsed !== null && ref && entry.isMeterReset) {
    deltaLine = t("readDialog.resetNoDelta");
  }

  const inputId = `read-${item.id}`;

  return (
    <div
      className={cn(
        "border-border space-y-2 rounded-lg border p-3",
        error && "border-destructive/60",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="bg-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
          <MeterIcon
            kind={item.kind}
            className={cn("h-4 w-4", meterTint(item.kind))}
          />
        </div>
        <label
          htmlFor={inputId}
          className="min-w-0 flex-1 truncate text-sm font-medium"
        >
          {item.name}
        </label>
        {unit && <span className="text-muted-foreground text-xs">{unit}</span>}
      </div>

      <div className="relative">
        <Input
          id={inputId}
          inputMode="decimal"
          value={entry.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={t("readDialog.valuePlaceholder")}
          aria-invalid={Boolean(error)}
          autoFocus={autoFocus && !isMobile}
          className={cn("tabular-nums", unit && "pr-14")}
        />
        {unit && (
          <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs">
            {unit}
          </span>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        {baseline.kind === "none" && t("readDialog.noPrevious")}
        {baseline.kind === "latest" &&
          t("readDialog.previous", {
            value: formatQuantity(
              baseline.reading.value,
              item.decimals,
              item.unit,
            ),
            date: formatReadingDate(baseline.reading.date, locale),
          })}
        {baseline.kind === "overwrite" && (
          <>
            {t("readDialog.overwrites", {
              date: formatReadingDate(date, locale),
            })}
            {baseline.reading &&
              ` ${t("readDialog.previous", {
                value: formatQuantity(
                  baseline.reading.value,
                  item.decimals,
                  item.unit,
                ),
                date: formatReadingDate(baseline.reading.date, locale),
              })}`}
          </>
        )}
        {baseline.kind === "older" &&
          t("validation.newerReadingExists", {
            date: formatReadingDate(item.latestReading!.date, locale),
          })}
      </p>

      {deltaLine && (
        <p
          className={cn(
            "text-xs tabular-nums",
            deltaNegative ? "text-expense" : "text-foreground",
          )}
        >
          {deltaLine}
        </p>
      )}

      {error && <FieldError errors={[{ message: error }]} />}

      {baseline.kind !== "none" && (
        <Field orientation="horizontal" className="pt-1">
          <FieldContent>
            <FieldTitle>{t("readDialog.resetLabel")}</FieldTitle>
            <FieldDescription>{t("readDialog.resetHint")}</FieldDescription>
          </FieldContent>
          <Switch
            checked={entry.isMeterReset}
            onCheckedChange={(checked) => onChange({ isMeterReset: checked })}
            aria-label={t("readDialog.resetLabel")}
          />
        </Field>
      )}
    </div>
  );
}
