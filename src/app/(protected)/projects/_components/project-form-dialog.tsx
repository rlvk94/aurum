"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { CalendarIcon } from "lucide-react";
import { format, parse } from "date-fns";
import { da, enUS } from "date-fns/locale";

import posthog from "posthog-js";
import { api } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { Calendar } from "~/app/_components/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/_components/popover";
import { cn } from "~/app/_lib/utils";

import { ProjectCover } from "./project-cover";
import {
  PROJECT_EMOJI_SUGGESTIONS,
  PROJECT_PALETTES,
  type ProjectPalette,
} from "../_lib/format";

type Project = {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  coverPalette: string;
  spendingLimit: number | null;
  startDate: string | null;
  endDate: string | null;
};

type Defaults = Partial<{
  name: string;
  emoji: string;
  coverPalette: ProjectPalette;
}>;

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  defaults,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project;
  defaults?: Defaults;
  onCreated?: (project: { id: string; name: string }) => void;
}) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const utils = api.useUtils();
  const locale = useLocale();
  const dateLocale = locale === "da" ? da : enUS;
  const isEdit = Boolean(project);

  const schema = useMemo(() => {
    const required = tValidation("required");
    return z
      .object({
        name: z.string().min(1, required).max(100),
        description: z.string().max(1000),
        emoji: z.string().min(1).max(8),
        coverPalette: z.enum(PROJECT_PALETTES),
        spendingLimit: z.string(),
        startDate: z.string(),
        endDate: z.string(),
      })
      .superRefine((data, ctx) => {
        if (data.spendingLimit) {
          const n = parseFloat(data.spendingLimit);
          if (!Number.isFinite(n) || n < 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: tValidation("positiveNumber"),
              path: ["spendingLimit"],
            });
          }
        }
        if (data.startDate && data.endDate && data.endDate < data.startDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: tValidation("invalid"),
            path: ["endDate"],
          });
        }
      });
  }, [tValidation]);

  const createProject = api.project.create.useMutation({
    onSuccess: (created, vars) => {
      posthog.capture("project_created", {
        has_limit: vars.spendingLimit != null,
        has_dates: vars.startDate != null || vars.endDate != null,
      });
      onOpenChange(false);
      form.reset();
      void utils.project.list.invalidate();
      if (created) onCreated?.({ id: created.id, name: created.name });
    },
  });

  const updateProject = api.project.update.useMutation({
    onSuccess: (_, vars) => {
      onOpenChange(false);
      void utils.project.list.invalidate();
      void utils.project.get.invalidate({ id: vars.id });
    },
  });

  const form = useForm({
    defaultValues: {
      name: project?.name ?? defaults?.name ?? "",
      description: project?.description ?? "",
      emoji: project?.emoji ?? defaults?.emoji ?? "📌",
      coverPalette:
        (project?.coverPalette as ProjectPalette | undefined) ??
        defaults?.coverPalette ??
        ("gold" satisfies ProjectPalette),
      spendingLimit: project?.spendingLimit
        ? String(project.spendingLimit / 100)
        : "",
      startDate: project?.startDate ?? "",
      endDate: project?.endDate ?? "",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const limitCents = value.spendingLimit
        ? Math.round(parseFloat(value.spendingLimit) * 100)
        : null;
      const description = value.description.trim() || null;
      const startDate = value.startDate || null;
      const endDate = value.endDate || null;

      if (isEdit && project) {
        updateProject.mutate({
          id: project.id,
          name: value.name.trim(),
          description,
          emoji: value.emoji,
          coverPalette: value.coverPalette,
          spendingLimit: limitCents,
          startDate,
          endDate,
        });
      } else {
        createProject.mutate({
          name: value.name.trim(),
          description: description ?? undefined,
          emoji: value.emoji,
          coverPalette: value.coverPalette,
          spendingLimit: limitCents ?? undefined,
          startDate,
          endDate,
        });
      }
    },
  });

  const mutation = isEdit ? updateProject : createProject;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) form.reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editProject") : t("createProject")}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Subscribe
              selector={(s) => ({
                emoji: s.values.emoji,
                palette: s.values.coverPalette,
                name: s.values.name,
              })}
            >
              {({ emoji, palette, name }) => (
                <div className="-mt-2">
                  <ProjectCover
                    palette={palette}
                    emoji={emoji || "📌"}
                    size="lg"
                  >
                    <div className="font-display absolute inset-x-4 bottom-3 z-20 truncate text-xl text-[var(--cover-glyph)]">
                      {name?.trim() || t("form.preview")}
                    </div>
                  </ProjectCover>
                </div>
              )}
            </form.Subscribe>

            <form.Field name="name">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("form.name")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t("form.namePlaceholder")}
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

            <form.Field name="emoji">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t("form.emoji")}
                  </FieldLabel>
                  <div className="flex items-stretch gap-2">
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(e.target.value.slice(0, 8))
                      }
                      onBlur={field.handleBlur}
                      maxLength={8}
                      className="w-16 text-center text-lg"
                    />
                    <div
                      role="listbox"
                      aria-label={t("form.emoji")}
                      className="border-input bg-background flex flex-1 flex-wrap items-center gap-1 rounded-md border p-1.5"
                    >
                      {PROJECT_EMOJI_SUGGESTIONS.map((e) => (
                        <button
                          type="button"
                          key={e}
                          onClick={() => field.handleChange(e)}
                          className={cn(
                            "hover:bg-accent h-8 w-8 rounded text-lg transition",
                            field.state.value === e &&
                              "bg-accent ring-primary ring-1",
                          )}
                          aria-pressed={field.state.value === e}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <FieldDescription>{t("form.emojiHint")}</FieldDescription>
                </Field>
              )}
            </form.Field>

            <form.Field name="coverPalette">
              {(field) => (
                <Field>
                  <FieldLabel>{t("form.palette")}</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {PROJECT_PALETTES.map((p) => {
                      const selected = field.state.value === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          aria-label={p}
                          aria-pressed={selected}
                          onClick={() => field.handleChange(p)}
                          data-project-palette={p}
                          className={cn(
                            "h-9 w-12 rounded-md transition",
                            selected
                              ? "ring-foreground ring-offset-background ring-2 ring-offset-2"
                              : "opacity-90 hover:opacity-100",
                          )}
                        />
                      );
                    })}
                  </div>
                </Field>
              )}
            </form.Field>

            <form.Field name="spendingLimit">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("form.spendingLimit")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                    />
                    <FieldDescription>
                      {t("form.spendingLimitHint")}
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <form.Field name="startDate">
                {(field) => {
                  const dateValue = field.state.value
                    ? parse(field.state.value, "yyyy-MM-dd", new Date())
                    : undefined;
                  return (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        {t("form.startDate")}
                      </FieldLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id={field.name}
                            type="button"
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !dateValue && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon />
                            {dateValue
                              ? format(dateValue, "PPP", { locale: dateLocale })
                              : "—"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateValue}
                            onSelect={(d) =>
                              field.handleChange(
                                d ? format(d, "yyyy-MM-dd") : "",
                              )
                            }
                            locale={dateLocale}
                          />
                        </PopoverContent>
                      </Popover>
                      {field.state.value && (
                        <button
                          type="button"
                          onClick={() => field.handleChange("")}
                          className="text-muted-foreground hover:text-foreground text-left text-xs"
                        >
                          {tCommon("delete")}
                        </button>
                      )}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="endDate">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  const dateValue = field.state.value
                    ? parse(field.state.value, "yyyy-MM-dd", new Date())
                    : undefined;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t("form.endDate")}
                      </FieldLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id={field.name}
                            type="button"
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal",
                              !dateValue && "text-muted-foreground",
                            )}
                            aria-invalid={isInvalid}
                          >
                            <CalendarIcon />
                            {dateValue
                              ? format(dateValue, "PPP", { locale: dateLocale })
                              : "—"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateValue}
                            onSelect={(d) =>
                              field.handleChange(
                                d ? format(d, "yyyy-MM-dd") : "",
                              )
                            }
                            locale={dateLocale}
                          />
                        </PopoverContent>
                      </Popover>
                      {field.state.value && (
                        <button
                          type="button"
                          onClick={() => field.handleChange("")}
                          className="text-muted-foreground hover:text-foreground text-left text-xs"
                        >
                          {tCommon("delete")}
                        </button>
                      )}
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              </form.Field>
            </div>
            <p className="text-muted-foreground text-xs">
              {t("form.datesOptional")}
            </p>

            <form.Field name="description">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t("form.description")}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t("form.descriptionPlaceholder")}
                  />
                </Field>
              )}
            </form.Field>
          </FieldGroup>

          {mutation.error && (
            <p className="text-destructive mt-4 text-sm">{tCommon("error")}</p>
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
