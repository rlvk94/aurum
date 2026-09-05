"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import posthog from "posthog-js";
import { format, setISODay } from "date-fns";
import { da, enUS } from "date-fns/locale";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Switch } from "~/app/_components/switch";
import { Skeleton } from "~/app/_components/skeleton";
import {
  Field,
  FieldContent,
  FieldDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/_components/select";
import { Tabs, TabsList, TabsTrigger } from "~/app/_components/tabs";
import type { ReminderCadence } from "~/lib/consumption-kinds";

type Settings = RouterOutputs["consumption"]["getSettings"];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

export function ReminderSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("consumption");
  const { data } = api.consumption.getSettings.useQuery(undefined, {
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reminders.title")}</DialogTitle>
          <DialogDescription>{t("reminders.description")}</DialogDescription>
        </DialogHeader>
        {data ? (
          <ReminderForm
            key={open ? "open" : "closed"}
            initial={data}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReminderForm({
  initial,
  onDone,
}: {
  initial: Settings;
  onDone: () => void;
}) {
  const t = useTranslations("consumption");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dateLocale = locale === "da" ? da : enUS;
  const utils = api.useUtils();

  const [enabled, setEnabled] = useState(initial.enabled);
  const [cadence, setCadence] = useState<ReminderCadence>(initial.cadence);
  const [dayOfMonth, setDayOfMonth] = useState(initial.dayOfMonth);
  const [weekday, setWeekday] = useState(initial.weekday);

  const update = api.consumption.updateSettings.useMutation({
    onSuccess: (_, vars) => {
      posthog.capture("consumption_reminder_updated", {
        enabled: vars.enabled,
        cadence: vars.cadence,
      });
      void utils.consumption.getSettings.invalidate();
      // Overdue flags depend on the schedule.
      void utils.consumption.listMeters.invalidate();
      void utils.consumption.summary.invalidate();
      onDone();
    },
  });

  const weekdayLabel = (n: number) => {
    const label = format(setISODay(new Date(), n), "EEEE", {
      locale: dateLocale,
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate({ enabled, cadence, dayOfMonth, weekday });
      }}
      className="space-y-5"
    >
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>{t("reminders.enabledLabel")}</FieldTitle>
          <FieldDescription>{t("reminders.enabledHint")}</FieldDescription>
        </FieldContent>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label={t("reminders.enabledLabel")}
        />
      </Field>

      <Field>
        <FieldLabel>{t("reminders.cadence")}</FieldLabel>
        <Tabs
          value={cadence}
          onValueChange={(v) => setCadence(v as ReminderCadence)}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="monthly" disabled={!enabled}>
              {t("reminders.monthly")}
            </TabsTrigger>
            <TabsTrigger value="weekly" disabled={!enabled}>
              {t("reminders.weekly")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Field>

      {cadence === "monthly" ? (
        <Field>
          <FieldLabel htmlFor="reminder-day">
            {t("reminders.dayOfMonth")}
          </FieldLabel>
          <Select
            value={String(dayOfMonth)}
            onValueChange={(v) => setDayOfMonth(Number(v))}
            disabled={!enabled}
          >
            <SelectTrigger id="reminder-day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d === 31
                    ? t("reminders.lastDayOfMonth")
                    : t("reminders.dayNumber", { day: d })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <Field>
          <FieldLabel htmlFor="reminder-weekday">
            {t("reminders.weekday")}
          </FieldLabel>
          <Select
            value={String(weekday)}
            onValueChange={(v) => setWeekday(Number(v))}
            disabled={!enabled}
          >
            <SelectTrigger id="reminder-weekday">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {weekdayLabel(n)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {update.error && (
        <p className="text-destructive text-sm">{tCommon("error")}</p>
      )}

      <DialogFooter className="mt-2 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/settings/notifications"
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          {t("reminders.channelsLink")}
        </Link>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? tCommon("loading") : tCommon("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
