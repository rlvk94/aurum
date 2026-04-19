"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

import { api } from "~/trpc/react";
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
import { CategoryPicker } from "~/app/_components/category-picker";
import { parseMoneyInput } from "~/app/(protected)/income-planner/_lib/format";
import { parseMonthsShort } from "../../_lib/budget-format";

type Recurrence = "monthly" | "quarterly" | "semi_annual" | "annual" | "custom";
const RECURRENCES: Recurrence[] = [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "custom",
];

function defaultStartForUi(recurrence: Recurrence, currentMonth: number): number {
  switch (recurrence) {
    case "monthly":
    case "custom":
      return 0;
    case "quarterly":
      return 2;
    case "semi_annual":
      return 5;
    case "annual":
      return currentMonth;
  }
}

export function AddLineDialog({
  budgetId,
  open,
  onOpenChange,
}: {
  budgetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const utils = api.useUtils();
  const months = useMemo(() => parseMonthsShort(t("monthsShort")), [t]);
  const currentMonth = new Date().getMonth();

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
    });
  }, [tValidation]);

  const create = api.budget.createLine.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      form.reset();
      void utils.budget.get.invalidate({ id: budgetId });
      void utils.budget.list.invalidate();
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      categoryId: "",
      recurrence: "monthly" as Recurrence,
      startMonth: 0,
      periodAmount: "",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const amount = parseMoneyInput(value.periodAmount);
      const needsStart =
        value.recurrence !== "monthly" && value.recurrence !== "custom";
      create.mutate({
        budgetId,
        categoryId: value.categoryId,
        name: value.name.trim(),
        recurrence: value.recurrence,
        startMonth: needsStart ? value.startMonth : null,
        periodAmount: amount ?? 0,
      });
    },
  });

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
          <DialogTitle>{t("addLine")}</DialogTitle>
          <DialogDescription>{t("addLineDescription")}</DialogDescription>
        </DialogHeader>

        {expenseCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noCategoriesYet")}</p>
        ) : (
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
                        autoFocus
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
                      onValueChange={(v) => {
                        const r = v as Recurrence;
                        field.handleChange(r);
                        form.setFieldValue(
                          "startMonth",
                          defaultStartForUi(r, currentMonth),
                        );
                      }}
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
                    <FieldDescription>{t("recurrenceHelp")}</FieldDescription>
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
                          {(field) => {
                            const isInvalid =
                              field.state.meta.isTouched &&
                              !field.state.meta.isValid;
                            return (
                              <Field data-invalid={isInvalid}>
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
                                  aria-invalid={isInvalid}
                                  className="almanac-numerals"
                                />
                                <FieldDescription>
                                  {t(`lineAmountHelp.${recurrence}`)}
                                </FieldDescription>
                                {isInvalid && (
                                  <FieldError errors={field.state.meta.errors} />
                                )}
                              </Field>
                            );
                          }}
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
            </FieldGroup>

            {create.error && (
              <p className="mt-4 text-sm text-destructive">{tCommon("error")}</p>
            )}

            <DialogFooter className="mt-6">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? tCommon("loading") : tCommon("create")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
