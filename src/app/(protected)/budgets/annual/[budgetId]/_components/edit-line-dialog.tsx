"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
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
import { Checkbox } from "~/app/_components/checkbox";
import { Label } from "~/app/_components/label";
import { CategoryPicker } from "~/app/_components/category-picker";
import {
  formatKronerInt,
  parseMoneyInput,
} from "~/app/(protected)/income-planner/_lib/format";
import { parseMonthsShort } from "../../_lib/budget-format";

type Line = RouterOutputs["budget"]["get"]["lines"][number];
type Recurrence = Line["recurrence"];
const RECURRENCES: Recurrence[] = [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "custom",
];

// From the existing `amounts` array + recurrence + startMonth, derive the
// per-period amount so we can prefill the form. For monthly this is the
// first non-zero slot; for bucketed recurrences it's the start slot.
function derivePeriodAmount(
  amounts: number[],
  recurrence: Recurrence,
  startMonth: number | null,
): number {
  const safeStart = startMonth ?? 0;
  switch (recurrence) {
    case "monthly": {
      const first = amounts.find((v) => v > 0);
      return first ?? 0;
    }
    case "custom":
      return amounts.reduce((acc, v) => acc + v, 0);
    default:
      return amounts[safeStart] ?? 0;
  }
}

export function EditLineDialog({
  budgetId,
  line,
  open,
  onOpenChange,
}: {
  budgetId: string;
  line: Line | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const utils = api.useUtils();
  const months = useMemo(() => parseMonthsShort(t("monthsShort")), [t]);

  const { data: categories } = api.category.list.useQuery();
  const expenseCategories = useMemo(
    () => (categories ?? []).filter((c) => c.kind === "expense" && !c.archived),
    [categories],
  );

  const schema = useMemo(() => {
    const required = tValidation("required");
    return z.object({
      name: z.string().trim().min(1, required).max(100),
      categoryId: z.string().min(1, required),
      recurrence: z.enum(["monthly", "quarterly", "semi_annual", "annual", "custom"]),
      startMonth: z.number().int().min(0).max(11),
      periodAmount: z.string().refine((v) => {
        if (v.trim() === "") return true;
        const n = parseMoneyInput(v);
        return n !== null && n >= 0;
      }, tValidation("invalid")),
      redistribute: z.boolean(),
    });
  }, [tValidation]);

  const onSuccess = () => {
    onOpenChange(false);
    void utils.budget.get.invalidate({ id: budgetId });
    void utils.budget.list.invalidate();
  };

  const update = api.budget.updateLine.useMutation({ onSuccess });
  const remove = api.budget.deleteLine.useMutation({ onSuccess });

  const initialPeriod = line
    ? derivePeriodAmount(line.amounts, line.recurrence, line.startMonth)
    : 0;

  const form = useForm({
    defaultValues: {
      name: line?.name ?? "",
      categoryId: line?.categoryId ?? "",
      recurrence: line?.recurrence ?? ("monthly" as Recurrence),
      startMonth: line?.startMonth ?? 0,
      periodAmount: line ? formatKronerInt(initialPeriod / 100) : "",
      redistribute: false,
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      if (!line) return;
      const parsed = parseMoneyInput(value.periodAmount);
      const needsStart =
        value.recurrence !== "monthly" && value.recurrence !== "custom";
      update.mutate({
        id: line.id,
        categoryId: value.categoryId,
        name: value.name.trim(),
        recurrence: value.recurrence,
        startMonth: needsStart ? value.startMonth : null,
        periodAmount: parsed ?? undefined,
        redistribute: value.redistribute,
      });
    },
  });

  const handleDelete = () => {
    if (!line) return;
    if (confirm(t("deleteLineConfirm"))) {
      remove.mutate({ id: line.id });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) form.reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editLine")}</DialogTitle>
          <DialogDescription>{t("editLineDescription")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="name">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("lineName")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t("lineNamePlaceholder")}
                      aria-invalid={isInvalid}
                    />
                    <FieldDescription>{t("lineNameHelp")}</FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="categoryId">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("lineCategory")}
                    </FieldLabel>
                    <CategoryPicker
                      id={field.name}
                      value={field.state.value || null}
                      onChange={(v) => field.handleChange(v ?? "")}
                      categories={expenseCategories}
                      kind="expense"
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="recurrence">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t("lineRecurrence")}
                  </FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as Recurrence)}
                  >
                    <SelectTrigger id={field.name}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRENCES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {t(`recurrences.${r}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>

            <form.Subscribe selector={(s) => s.values.recurrence}>
              {(recurrence) => {
                const showStart =
                  recurrence !== "monthly" && recurrence !== "custom";
                return (
                  <>
                    {showStart && (
                      <form.Field name="startMonth">
                        {(field) => (
                          <Field>
                            <FieldLabel htmlFor={field.name}>
                              {t("lineStartMonth")}
                            </FieldLabel>
                            <Select
                              value={String(field.state.value)}
                              onValueChange={(v) =>
                                field.handleChange(parseInt(v, 10))
                              }
                            >
                              <SelectTrigger id={field.name}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {months.map((m, i) => (
                                  <SelectItem key={m} value={String(i)}>
                                    {m}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FieldDescription>
                              {t("lineStartMonthHelp")}
                            </FieldDescription>
                          </Field>
                        )}
                      </form.Field>
                    )}
                    {recurrence !== "custom" && (
                      <form.Field name="periodAmount">
                        {(field) => (
                          <Field>
                            <FieldLabel htmlFor={field.name}>
                              {t(`lineAmountLabel.${recurrence}`)}
                            </FieldLabel>
                            <Input
                              id={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              placeholder="0"
                              inputMode="numeric"
                              className="almanac-numerals"
                            />
                            <FieldDescription>
                              {t(`lineAmountHelp.${recurrence}`)}
                            </FieldDescription>
                          </Field>
                        )}
                      </form.Field>
                    )}
                    {recurrence === "custom" && (
                      <p className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                        {t("lineCustomHelp")}
                      </p>
                    )}
                  </>
                );
              }}
            </form.Subscribe>

            <form.Field name="redistribute">
              {(field) => (
                <Field>
                  <label
                    htmlFor={field.name}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <Checkbox
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={(next) =>
                        field.handleChange(next === true)
                      }
                      className="mt-0.5 h-4 w-4"
                    />
                    <Label
                      htmlFor={field.name}
                      className="flex-1 cursor-pointer text-xs leading-snug"
                    >
                      {t("lineRedistribute")}
                    </Label>
                  </label>
                </Field>
              )}
            </form.Field>
          </FieldGroup>

          {(update.error ?? remove.error) && (
            <p className="mt-4 text-sm text-destructive">{tCommon("error")}</p>
          )}

          <DialogFooter className="mt-6 flex flex-row items-center justify-between gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={remove.isPending}
            >
              {t("deleteLine")}
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
