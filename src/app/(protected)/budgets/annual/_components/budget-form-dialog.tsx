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
import { Checkbox } from "~/app/_components/checkbox";

type Budget = RouterOutputs["budget"]["list"][number];

export function BudgetFormDialog({
  open,
  onOpenChange,
  budget,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: Budget;
}) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const utils = api.useUtils();
  const isEdit = Boolean(budget);

  const { data: accounts } = api.financialAccount.list.useQuery();
  const activeAccounts = useMemo(
    () => (accounts ?? []).filter((a) => !a.archived),
    [accounts],
  );

  const schema = useMemo(() => {
    const required = tValidation("required");
    return z.object({
      year: z
        .string()
        .regex(/^\d{4}$/, tValidation("invalid"))
        .refine((v) => {
          const n = parseInt(v, 10);
          return n >= 1900 && n <= 3000;
        }, tValidation("invalid")),
      name: z.string().min(1, required).max(100),
      description: z.string().max(1000),
      accountIds: z.array(z.string().uuid()),
    });
  }, [tValidation]);

  const onSuccess = () => {
    onOpenChange(false);
    void utils.budget.list.invalidate();
    if (budget) void utils.budget.get.invalidate({ id: budget.id });
  };

  const create = api.budget.create.useMutation({ onSuccess });
  const update = api.budget.update.useMutation({ onSuccess });

  const form = useForm({
    defaultValues: {
      year: String(budget?.year ?? new Date().getFullYear()),
      name: budget?.name ?? "",
      description: budget?.description ?? "",
      accountIds: budget?.accountIds ?? [],
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const year = parseInt(value.year, 10);
      const description = value.description.trim() || undefined;
      if (isEdit && budget) {
        update.mutate({
          id: budget.id,
          year,
          name: value.name.trim(),
          description: description ?? null,
          accountIds: value.accountIds,
        });
      } else {
        create.mutate({
          year,
          name: value.name.trim(),
          description,
          accountIds: value.accountIds,
        });
      }
    },
  });

  const mutation = isEdit ? update : create;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) form.reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editBudget") : t("createBudget")}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t("editBudgetDescription") : t("createBudgetDescription")}
          </DialogDescription>
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
                      {t("budgetName")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t("budgetNamePlaceholder")}
                      aria-invalid={isInvalid}
                      autoFocus={!isEdit}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="year">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("budgetYear")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      type="number"
                      step="1"
                      min="1900"
                      max="3000"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="description">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t("budgetDescription")}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t("budgetDescriptionPlaceholder")}
                  />
                </Field>
              )}
            </form.Field>

            <form.Field name="accountIds">
              {(field) => {
                const selected = new Set(field.state.value);
                return (
                  <Field>
                    <FieldLabel>{t("budgetAccounts")}</FieldLabel>
                    {activeAccounts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {t("budgetAccountsAll")}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                        {activeAccounts.map((a) => {
                          const checked = selected.has(a.id);
                          const id = `budget-account-${a.id}`;
                          return (
                            <label
                              key={a.id}
                              htmlFor={id}
                              className="flex cursor-pointer items-center gap-2"
                            >
                              <Checkbox
                                id={id}
                                checked={checked}
                                onCheckedChange={(next) => {
                                  const updated = new Set(field.state.value);
                                  if (next) updated.add(a.id);
                                  else updated.delete(a.id);
                                  field.handleChange(Array.from(updated));
                                }}
                                className="h-4 w-4"
                              />
                              <span className="text-sm">{a.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    <FieldDescription>
                      {t("budgetAccountsHelp")}
                    </FieldDescription>
                  </Field>
                );
              }}
            </form.Field>
          </FieldGroup>

          {mutation.error && (
            <p className="mt-4 text-sm text-destructive">{tCommon("error")}</p>
          )}

          <DialogFooter className="mt-6">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? tCommon("loading")
                : isEdit
                  ? tCommon("save")
                  : tCommon("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
