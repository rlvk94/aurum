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
import { defaultCopyName } from "../_lib/budget-format";

type Budget = RouterOutputs["budget"]["list"][number];

export function CopyBudgetDialog({
  open,
  onOpenChange,
  budget,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: Budget | null;
}) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const utils = api.useUtils();

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
      name: z.string().trim().min(1, required).max(100),
    });
  }, [tValidation]);

  const duplicate = api.budget.duplicate.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      void utils.budget.list.invalidate();
    },
  });

  const sourceYear = budget?.year ?? new Date().getFullYear();
  const targetYear = sourceYear + 1;

  const form = useForm({
    defaultValues: {
      year: String(targetYear),
      name: budget ? defaultCopyName(budget.name, sourceYear, targetYear) : "",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      if (!budget) return;
      duplicate.mutate({
        id: budget.id,
        year: parseInt(value.year, 10),
        name: value.name.trim(),
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("copyBudget")}</DialogTitle>
          <DialogDescription>
            {t("copyBudgetDescription", { name: budget?.name ?? "" })}
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
                    <FieldLabel htmlFor={`copy-${field.name}`}>
                      {t("budgetName")}
                    </FieldLabel>
                    <Input
                      id={`copy-${field.name}`}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t("budgetNamePlaceholder")}
                      aria-invalid={isInvalid}
                      autoFocus
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
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
                    <FieldLabel htmlFor={`copy-${field.name}`}>
                      {t("budgetYear")}
                    </FieldLabel>
                    <Input
                      id={`copy-${field.name}`}
                      type="number"
                      step="1"
                      min="1900"
                      max="3000"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                    <FieldDescription>
                      {t("copyBudgetHelp", { count: budget?.lineCount ?? 0 })}
                    </FieldDescription>
                  </Field>
                );
              }}
            </form.Field>
          </FieldGroup>

          {duplicate.error && (
            <p className="text-destructive mt-4 text-sm">{tCommon("error")}</p>
          )}

          <DialogFooter className="mt-6">
            <Button type="submit" disabled={duplicate.isPending || !budget}>
              {duplicate.isPending ? tCommon("loading") : t("copyBudgetSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
