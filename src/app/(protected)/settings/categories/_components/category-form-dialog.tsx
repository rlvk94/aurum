"use client";

import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/_components/select";
import { cn } from "~/app/_lib/utils";

type Category = RouterOutputs["category"]["list"][number];

const NO_PARENT = "__none__";

const categoryFormSchema = z.object({
  name: z.string().min(1, "Required").max(100),
  kind: z.enum(["expense", "income"]),
  parentId: z.string(),
  icon: z.string(),
});

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  allCategories,
  defaultKind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category;
  allCategories: Category[];
  defaultKind?: "expense" | "income";
}) {
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");
  const tTx = useTranslations("transactions");
  const utils = api.useUtils();
  const isEdit = !!category;

  const createCategory = api.category.create.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      form.reset();
      void utils.category.list.invalidate();
    },
  });

  const updateCategory = api.category.update.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      void utils.category.list.invalidate();
    },
  });

  const form = useForm({
    defaultValues: {
      name: category?.name ?? "",
      kind: (category?.kind as "expense" | "income") ?? defaultKind ?? "expense",
      parentId: category?.parentId ?? "",
      icon: category?.icon ?? "",
    },
    validators: {
      onSubmit: categoryFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        updateCategory.mutate({
          id: category.id,
          name: value.name.trim(),
          parentId: value.parentId || null,
          icon: value.icon.trim() || null,
        });
      } else {
        createCategory.mutate({
          name: value.name.trim(),
          kind: value.kind,
          parentId: value.parentId || null,
          icon: value.icon.trim() || null,
        });
      }
    },
  });

  const mutation = isEdit ? updateCategory : createCategory;

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
          <DialogTitle>
            {isEdit ? t("editCategory") : t("addCategory")}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t("editCategoryDescription") : t("addCategoryDescription")}
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
              name="name"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("categoryName")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder={t("categoryNamePlaceholder")}
                      autoFocus
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            />

            <form.Field
              name="icon"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t("categoryIcon")}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t("categoryIconPlaceholder")}
                    maxLength={4}
                    className="w-24 text-center text-lg"
                  />
                </Field>
              )}
            />

            {!isEdit && (
              <form.Field
                name="kind"
                children={(field) => (
                  <Field>
                    <FieldLabel>{t("categoryKind")}</FieldLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {(["expense", "income"] as const).map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => {
                            field.handleChange(kind);
                            // Reset parent when kind changes
                            form.setFieldValue("parentId", "");
                          }}
                          className={cn(
                            "rounded-lg border p-3 text-sm transition-all",
                            field.state.value === kind
                              ? kind === "expense"
                                ? "border-expense bg-expense-muted text-expense"
                                : "border-income bg-income-muted text-income"
                              : "border-border bg-card text-muted-foreground hover:border-primary/30",
                          )}
                        >
                          {tTx(kind)}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}
              />
            )}

            <form.Subscribe
              selector={(state) => state.values.kind}
              children={(kind) => {
                const possibleParents = allCategories.filter(
                  (c) =>
                    c.kind === kind &&
                    !c.parentId &&
                    !c.archived &&
                    c.id !== category?.id,
                );
                return (
                  <form.Field
                    name="parentId"
                    children={(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          {t("parent")}
                        </FieldLabel>
                        <Select
                          value={field.state.value || NO_PARENT}
                          onValueChange={(v) =>
                            field.handleChange(v === NO_PARENT ? "" : v)
                          }
                        >
                          <SelectTrigger id={field.name}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_PARENT}>
                              {t("noParent")}
                            </SelectItem>
                            {possibleParents.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.icon && <span className="mr-1.5">{c.icon}</span>}
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  />
                );
              }}
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
