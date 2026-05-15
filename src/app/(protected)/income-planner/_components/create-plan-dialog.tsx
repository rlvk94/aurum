"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

import posthog from "posthog-js";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import {
  Field,
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

type Plan = RouterOutputs["incomePlan"]["list"][number];

export function CreatePlanDialog({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: Plan;
}) {
  const t = useTranslations("incomePlanner");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const utils = api.useUtils();
  const isEdit = Boolean(plan);

  const schema = useMemo(() => {
    const required = tValidation("required");
    return z.object({
      name: z.string().min(1, required).max(100),
      description: z.string(),
    });
  }, [tValidation]);

  const createPlan = api.incomePlan.create.useMutation({
    onSuccess: () => {
      posthog.capture("income_plan_created");
      onOpenChange(false);
      form.reset();
      void utils.incomePlan.list.invalidate();
    },
  });

  const updatePlan = api.incomePlan.update.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      void utils.incomePlan.list.invalidate();
    },
  });

  const form = useForm({
    defaultValues: {
      name: plan?.name ?? "",
      description: plan?.description ?? "",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const description = value.description.trim() || undefined;
      if (isEdit && plan) {
        updatePlan.mutate({
          id: plan.id,
          name: value.name.trim(),
          description: description ?? null,
        });
      } else {
        createPlan.mutate({
          name: value.name.trim(),
          description,
        });
      }
    },
  });

  const mutation = isEdit ? updatePlan : createPlan;

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
          <DialogTitle>{isEdit ? t("editPlan") : t("newPlan")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
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
                      {t("planName")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t("planNamePlaceholder")}
                      aria-invalid={isInvalid}
                      autoFocus={!isEdit}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="description">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t("planDescription")}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t("planDescriptionPlaceholder")}
                  />
                </Field>
              )}
            </form.Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {isEdit ? tCommon("save") : t("createPlan")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
