"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { X } from "lucide-react";
import { z } from "zod";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { Badge } from "~/app/_components/badge";
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

type Category = RouterOutputs["category"]["list"][number];

const NO_PARENT = "__none__";

function KeywordsField({
  value,
  onChange,
  placeholder,
  label,
  help,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  label: string;
  help: string;
}) {
  const [input, setInput] = useState("");
  const addKeyword = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  }, [input, value, onChange]);

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {value.map((kw, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1">
            {kw}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="rounded-full p-0.5 hover:bg-muted"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addKeyword();
          }
        }}
        onBlur={addKeyword}
        placeholder={placeholder}
      />
      <FieldDescription>{help}</FieldDescription>
    </Field>
  );
}

const categoryFormSchema = z.object({
  name: z.string().min(1, "Required").max(100),
  parentId: z.string(),
  icon: z.string(),
  keywords: z.array(z.string()),
});

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  allCategories,
  defaultParentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category;
  allCategories: Category[];
  defaultParentId?: string;
}) {
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();
  const isEdit = category !== undefined;

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
      parentId: category?.parentId ?? defaultParentId ?? "",
      icon: category?.icon ?? "",
      keywords: category?.keywords ?? [],
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
          keywords: value.keywords,
        });
      } else {
        createCategory.mutate({
          name: value.name.trim(),
          parentId: value.parentId || null,
          icon: value.icon.trim() || null,
          keywords: value.keywords,
        });
      }
    },
  });

  const mutation = isEdit ? updateCategory : createCategory;

  const possibleParents = allCategories.filter(
    (c) => !c.parentId && !c.archived && c.id !== category?.id,
  );

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

            <form.Subscribe
              selector={(state) => state.values.parentId}
              children={(parentId) =>
                parentId ? (
                  <form.Field
                    name="keywords"
                    children={(field) => (
                      <KeywordsField
                        value={field.state.value}
                        onChange={field.handleChange}
                        label={t("keywords")}
                        placeholder={t("keywordsPlaceholder")}
                        help={t("keywordsHelp")}
                      />
                    )}
                  />
                ) : null
              }
            />

            {isEdit && category?.parentId && (
              <form.Field
                name="parentId"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>{t("parent")}</FieldLabel>
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
                        {possibleParents.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.icon && (
                              <span className="mr-1.5">{c.icon}</span>
                            )}
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            )}
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
