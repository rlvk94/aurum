"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { format } from "date-fns";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { Switch } from "~/app/_components/switch";
import { DatePicker } from "~/app/_components/date-picker";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
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
  formatQuantityInput,
  formatUnit,
  parseQuantityInput,
} from "../../_lib/format";

type Reading = RouterOutputs["consumption"]["getMeter"]["readings"][number];

export function ReadingFormDialog({
  open,
  onOpenChange,
  reading,
  meterId,
  decimals,
  unit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reading: Reading | null;
  meterId: string;
  decimals: number;
  unit: string;
}) {
  const t = useTranslations("consumption");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const utils = api.useUtils();

  const [date, setDate] = useState(
    reading?.date ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [value, setValue] = useState(
    reading ? formatQuantityInput(reading.value, decimals) : "",
  );
  const [isMeterReset, setIsMeterReset] = useState(
    reading?.isMeterReset ?? false,
  );
  const [note, setNote] = useState(reading?.note ?? "");
  const [errors, setErrors] = useState<{ date?: string; value?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const update = api.consumption.updateReading.useMutation({
    onSuccess: () => {
      posthog.capture("consumption_reading_updated");
      void utils.consumption.getMeter.invalidate({ id: meterId });
      void utils.consumption.listMeters.invalidate();
      void utils.consumption.summary.invalidate();
      onOpenChange(false);
    },
    onError: (e) => {
      if (e.message === "reading_below_previous") {
        setServerError(t("validation.belowPreviousGeneric"));
      } else if (e.message === "reading_exists_for_date") {
        setServerError(t("validation.readingExistsForDate"));
      } else {
        setServerError(tCommon("error"));
      }
    },
  });

  const submit = () => {
    if (!reading) return;
    setServerError(null);
    const next: typeof errors = {};
    const today = format(new Date(), "yyyy-MM-dd");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = tValidation("required");
    else if (date > today) next.date = t("validation.dateInFuture");
    const parsed = parseQuantityInput(value);
    if (parsed === null) next.value = tValidation("invalid");
    else if (parsed < 0) next.value = tValidation("positiveNumber");
    setErrors(next);
    if (Object.keys(next).length > 0 || parsed === null) return;

    update.mutate({
      id: reading.id,
      date,
      value: parsed,
      isMeterReset,
      note: note.trim() ? note.trim() : null,
    });
  };

  const u = formatUnit(unit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("readings.editTitle")}</DialogTitle>
          <DialogDescription>{t("readings.editDescription")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FieldGroup>
            <Field data-invalid={Boolean(errors.date)}>
              <FieldLabel htmlFor="reading-date">{tCommon("date")}</FieldLabel>
              <DatePicker
                id="reading-date"
                value={date}
                onChange={setDate}
                maxYear={new Date().getFullYear()}
                aria-invalid={Boolean(errors.date)}
              />
              {errors.date && (
                <FieldError errors={[{ message: errors.date }]} />
              )}
            </Field>

            <Field data-invalid={Boolean(errors.value)}>
              <FieldLabel htmlFor="reading-value">
                {t("readings.value")}
              </FieldLabel>
              <div className="relative">
                <Input
                  id="reading-value"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  aria-invalid={Boolean(errors.value)}
                  className={u ? "pr-14 tabular-nums" : "tabular-nums"}
                  autoFocus
                />
                {u && (
                  <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs">
                    {u}
                  </span>
                )}
              </div>
              {errors.value && (
                <FieldError errors={[{ message: errors.value }]} />
              )}
            </Field>

            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{t("readDialog.resetLabel")}</FieldTitle>
                <FieldDescription>{t("readDialog.resetHint")}</FieldDescription>
              </FieldContent>
              <Switch
                checked={isMeterReset}
                onCheckedChange={setIsMeterReset}
                aria-label={t("readDialog.resetLabel")}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="reading-note">
                {t("readings.note")}
              </FieldLabel>
              <Input
                id="reading-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("readings.notePlaceholder")}
                maxLength={500}
              />
            </Field>
          </FieldGroup>

          {serverError && (
            <p className="text-destructive mt-4 text-sm">{serverError}</p>
          )}

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? tCommon("loading") : tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
