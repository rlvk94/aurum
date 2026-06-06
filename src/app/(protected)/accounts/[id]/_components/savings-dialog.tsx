"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { CircleDollarSign, HandCoins, CalendarClock } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { useIsMobile } from "~/app/_hooks/use-mobile";
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
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "~/app/_components/drawer";
import { cn } from "~/app/_lib/utils";
import {
  PROJECT_PALETTES,
  type ProjectPalette,
} from "~/app/(protected)/projects/_lib/format";

type Savings = RouterOutputs["savings"]["list"][number];

const SAVINGS_EMOJI_SUGGESTIONS = [
  "🎯",
  "🏖️",
  "🏠",
  "🚗",
  "💍",
  "🎓",
  "🎁",
  "🪙",
  "💰",
  "🐖",
  "✈️",
  "🛋️",
] as const;

const ROUNDING_OPTIONS = [
  { value: 500, labelKey: "rounding5" as const },
  { value: 1000, labelKey: "rounding10" as const },
  { value: 5000, labelKey: "rounding50" as const },
  { value: 10000, labelKey: "rounding100" as const },
];

const MODE_ICONS = {
  manual: HandCoins,
  monthly_fixed: CalendarClock,
  rounding: CircleDollarSign,
} as const;

export function SavingsDialog({
  open,
  onOpenChange,
  accountId,
  savings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  savings?: Savings;
}) {
  const t = useTranslations("savings");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const utils = api.useUtils();
  const isEdit = Boolean(savings);

  const schema = useMemo(() => {
    const required = tValidation("required");
    const positive = tValidation("positiveNumber");
    return z
      .object({
        name: z.string().min(1, required).max(100),
        emoji: z.string().min(1).max(8),
        color: z.enum(PROJECT_PALETTES),
        targetAmount: z.string().refine(
          (v) => {
            const n = parseFloat(v);
            return Number.isFinite(n) && n > 0;
          },
          { message: positive },
        ),
        transferMode: z.enum(["manual", "monthly_fixed", "rounding"]),
        monthlyAmount: z.string(),
        roundingStep: z.string(),
      })
      .superRefine((data, ctx) => {
        if (data.transferMode === "monthly_fixed") {
          const n = parseFloat(data.monthlyAmount);
          if (!Number.isFinite(n) || n <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: positive,
              path: ["monthlyAmount"],
            });
          }
        }
        if (data.transferMode === "rounding") {
          const n = parseInt(data.roundingStep, 10);
          if (![500, 1000, 5000, 10000].includes(n)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: required,
              path: ["roundingStep"],
            });
          }
        }
      });
  }, [tValidation]);

  const create = api.savings.create.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      form.reset();
      void utils.savings.list.invalidate();
      void utils.savings.reservedByAccount.invalidate();
      void utils.financialAccount.summary.invalidate();
    },
  });

  const update = api.savings.update.useMutation({
    onSuccess: (_, vars) => {
      onOpenChange(false);
      void utils.savings.list.invalidate();
      void utils.savings.get.invalidate({ id: vars.id });
    },
  });

  const form = useForm({
    defaultValues: {
      name: savings?.name ?? "",
      emoji: savings?.emoji ?? "🎯",
      color: (savings?.color as ProjectPalette | undefined) ??
        ("gold" satisfies ProjectPalette),
      targetAmount: savings ? String(savings.targetAmount / 100) : "",
      transferMode: savings?.transferMode ?? "manual",
      monthlyAmount: savings?.monthlyAmount
        ? String(savings.monthlyAmount / 100)
        : "",
      roundingStep: savings?.roundingStep
        ? String(savings.roundingStep)
        : "1000",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const targetCents = Math.round(parseFloat(value.targetAmount) * 100);
      const monthlyCents =
        value.transferMode === "monthly_fixed"
          ? Math.round(parseFloat(value.monthlyAmount) * 100)
          : undefined;
      const step =
        value.transferMode === "rounding"
          ? (parseInt(value.roundingStep, 10) as 500 | 1000 | 5000 | 10000)
          : undefined;

      if (isEdit && savings) {
        update.mutate({
          id: savings.id,
          name: value.name.trim(),
          emoji: value.emoji,
          color: value.color,
          targetAmount: targetCents,
          transferMode: value.transferMode,
          monthlyAmount: monthlyCents ?? null,
          roundingStep: step ?? null,
        });
      } else {
        create.mutate({
          accountId,
          name: value.name.trim(),
          emoji: value.emoji,
          color: value.color,
          targetAmount: targetCents,
          transferMode: value.transferMode,
          monthlyAmount: monthlyCents,
          roundingStep: step,
        });
      }
    },
  });

  const mutation = isEdit ? update : create;
  const isMobile = useIsMobile();
  const title = isEdit ? t("dialog.editTitle") : t("dialog.createTitle");
  const description = isEdit
    ? t("dialog.editDescription")
    : t("dialog.createDescription");

  const formBody = (
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
                      {t("dialog.name")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t("dialog.namePlaceholder")}
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
                    {t("dialog.emoji")}
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
                      aria-label={t("dialog.emoji")}
                      className="flex flex-1 flex-wrap items-center gap-1 rounded-md border border-input bg-background p-1.5"
                    >
                      {SAVINGS_EMOJI_SUGGESTIONS.map((e) => (
                        <button
                          type="button"
                          key={e}
                          onClick={() => field.handleChange(e)}
                          className={cn(
                            "h-8 w-8 rounded text-lg transition hover:bg-accent",
                            field.state.value === e &&
                              "bg-accent ring-1 ring-primary",
                          )}
                          aria-pressed={field.state.value === e}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                </Field>
              )}
            </form.Field>

            <form.Field name="color">
              {(field) => (
                <Field>
                  <FieldLabel>{t("dialog.color")}</FieldLabel>
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
                              ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                              : "opacity-90 hover:opacity-100",
                          )}
                        />
                      );
                    })}
                  </div>
                </Field>
              )}
            </form.Field>

            <form.Field name="targetAmount">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("dialog.targetAmount")}
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
                      {t("dialog.targetAmountHint")}
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="transferMode">
              {(field) => (
                <Field>
                  <FieldLabel>{t("dialog.transferMode")}</FieldLabel>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(["manual", "monthly_fixed", "rounding"] as const).map(
                      (m) => {
                        const selected = field.state.value === m;
                        const Icon = MODE_ICONS[m];
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => field.handleChange(m)}
                            aria-pressed={selected}
                            className={cn(
                              "flex flex-col items-start justify-start rounded-md border border-input bg-card p-3 text-left text-sm transition",
                              selected
                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                : "hover:bg-accent",
                            )}
                          >
                            <div className="flex items-center gap-2 font-medium">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              {t(`mode.${m}`)}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {t(`mode.${m}Hint`)}
                            </div>
                          </button>
                        );
                      },
                    )}
                  </div>
                </Field>
              )}
            </form.Field>

            <form.Subscribe selector={(s) => s.values.transferMode}>
              {(mode) => (
                <>
                  {mode === "monthly_fixed" && (
                    <form.Field name="monthlyAmount">
                      {(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>
                              {t("dialog.monthlyAmount")}
                            </FieldLabel>
                            <Input
                              id={field.name}
                              type="number"
                              step="1"
                              min="0"
                              placeholder="0"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              aria-invalid={isInvalid}
                            />
                            <FieldDescription>
                              {t("dialog.monthlyAmountHint")}
                            </FieldDescription>
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>
                  )}
                  {mode === "rounding" && (
                    <form.Field name="roundingStep">
                      {(field) => (
                        <Field>
                          <FieldLabel>{t("dialog.roundingStep")}</FieldLabel>
                          <div className="grid grid-cols-4 gap-2">
                            {ROUNDING_OPTIONS.map((opt) => {
                              const selected =
                                field.state.value === String(opt.value);
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() =>
                                    field.handleChange(String(opt.value))
                                  }
                                  aria-pressed={selected}
                                  className={cn(
                                    "rounded-md border border-input bg-card py-2 text-sm font-medium transition",
                                    selected
                                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                                      : "hover:bg-accent",
                                  )}
                                >
                                  {t(`dialog.${opt.labelKey}`)}
                                </button>
                              );
                            })}
                          </div>
                          <FieldDescription>
                            {t("dialog.roundingStepHint")}
                          </FieldDescription>
                        </Field>
                      )}
                    </form.Field>
                  )}
                </>
              )}
            </form.Subscribe>
          </FieldGroup>

      {mutation.error && (
        <p className="mt-4 text-sm text-destructive">{tCommon("error")}</p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? tCommon("loading")
            : isEdit
              ? tCommon("save")
              : tCommon("create")}
        </Button>
      </div>
    </form>
  );

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) form.reset();
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange} repositionInputs={false}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{formBody}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {formBody}
      </DialogContent>
    </Dialog>
  );
}
