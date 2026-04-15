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

type Rule = RouterOutputs["categorizationRule"]["list"][number];
type Category = RouterOutputs["category"]["list"][number];

const ruleFormSchema = z.object({
  pattern: z.string().min(1, "Required").max(200),
  categoryId: z.string().uuid("Required"),
  priority: z.string(),
});

export function RuleFormDialog({
  open,
  onOpenChange,
  rule,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: Rule;
  categories: Category[];
}) {
  const t = useTranslations("rules");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();
  const isEdit = !!rule;

  const availableCategories = useMemo(
    () => categories.filter((c) => !c.archived),
    [categories],
  );

  const createRule = api.categorizationRule.create.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      form.reset();
      void utils.categorizationRule.list.invalidate();
      void utils.categorizationRule.previewApply.invalidate();
    },
  });

  const updateRule = api.categorizationRule.update.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      void utils.categorizationRule.list.invalidate();
      void utils.categorizationRule.previewApply.invalidate();
    },
  });

  const form = useForm({
    defaultValues: {
      pattern: rule?.pattern ?? "",
      categoryId: rule?.categoryId ?? "",
      priority: String(rule?.priority ?? 0),
    },
    validators: {
      onSubmit: ruleFormSchema,
    },
    onSubmit: async ({ value }) => {
      const priority = parseInt(value.priority, 10) || 0;
      if (isEdit) {
        updateRule.mutate({
          id: rule.id,
          pattern: value.pattern.trim(),
          categoryId: value.categoryId,
          priority,
        });
      } else {
        createRule.mutate({
          pattern: value.pattern.trim(),
          categoryId: value.categoryId,
          priority,
        });
      }
    },
  });

  const mutation = isEdit ? updateRule : createRule;

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
          <DialogTitle>{isEdit ? t("editRule") : t("addRule")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("editRuleDescription") : t("addRuleDescription")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field
              name="pattern"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("pattern")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder={t("patternPlaceholder")}
                      autoFocus
                    />
                    <FieldDescription>{t("patternHelp")}</FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            />

            <form.Field
              name="categoryId"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("category")}
                    </FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                        <SelectValue placeholder={t("category")} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.icon && <span className="mr-1.5">{c.icon}</span>}
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            />

            <form.Field
              name="priority"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t("priority")}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    type="number"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="w-24"
                  />
                  <FieldDescription>{t("priorityHelp")}</FieldDescription>
                </Field>
              )}
            />
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
