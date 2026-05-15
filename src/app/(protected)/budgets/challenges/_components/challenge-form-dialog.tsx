"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { format } from "date-fns";

import posthog from "posthog-js";
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
import { DatePicker } from "~/app/_components/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/_components/select";
import { RadioGroup, RadioGroupItem } from "~/app/_components/radio-group";
import { Label } from "~/app/_components/label";
import { Checkbox } from "~/app/_components/checkbox";
import { CategorySelect } from "~/app/_components/category-select";

type Challenge = RouterOutputs["challenge"]["list"][number];
type ChallengeType = Challenge["type"];
type Repetition = Challenge["repetition"];

const TYPES: ChallengeType[] = [
  "spend_less",
  "savings",
  "pay_off_loan",
  "net_worth_goal",
];
const REPETITIONS: Repetition[] = [
  "one_off",
  "weekly",
  "monthly",
  "yearly",
  "custom",
];

export function ChallengeFormDialog({
  open,
  onOpenChange,
  challenge,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge?: Challenge;
}) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const utils = api.useUtils();
  const isEdit = Boolean(challenge);

  const { data: categories } = api.category.list.useQuery();
  const { data: accounts } = api.financialAccount.list.useQuery();
  const { data: debts } = api.debt.list.useQuery();

  const schema = useMemo(() => {
    const required = tValidation("required");
    return z
      .object({
        name: z.string().min(1, required).max(100),
        description: z.string(),
        type: z.enum([
          "spend_less",
          "savings",
          "pay_off_loan",
          "net_worth_goal",
        ]),
        repetition: z.enum([
          "one_off",
          "weekly",
          "monthly",
          "yearly",
          "custom",
        ]),
        targetAmount: z
          .string()
          .refine((v) => parseFloat(v) > 0, tValidation("positiveNumber")),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, tValidation("invalid")),
        endDate: z.string(),
        customDurationDays: z.string(),
        categoryIds: z.array(z.string()),
        accountId: z.string(),
        debtId: z.string(),
        accountIds: z.array(z.string()),
      })
      .superRefine((data, ctx) => {
        if (data.repetition === "one_off" || data.type === "net_worth_goal") {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(data.endDate)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: required,
              path: ["endDate"],
            });
          }
        }
        if (data.repetition === "custom") {
          const n = parseInt(data.customDurationDays, 10);
          if (!Number.isFinite(n) || n < 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: required,
              path: ["customDurationDays"],
            });
          }
        }
        if (
          (data.type === "spend_less" || data.type === "pay_off_loan") &&
          data.categoryIds.length === 0
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: required,
            path: ["categoryIds"],
          });
        }
        if (data.type === "savings" && !data.accountId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: required,
            path: ["accountId"],
          });
        }
      });
  }, [tValidation]);

  const createChallenge = api.challenge.create.useMutation({
    onSuccess: (_, variables) => {
      posthog.capture("challenge_created", {
        type: variables.type,
        repetition: variables.repetition,
        target_amount_cents: variables.targetAmount,
      });
      onOpenChange(false);
      form.reset();
      void utils.challenge.list.invalidate();
    },
  });

  const updateChallenge = api.challenge.update.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      void utils.challenge.list.invalidate();
    },
  });

  const form = useForm({
    defaultValues: {
      name: challenge?.name ?? "",
      description: challenge?.description ?? "",
      type: challenge?.type ?? ("spend_less" satisfies ChallengeType),
      repetition: challenge?.repetition ?? ("one_off" satisfies Repetition),
      targetAmount: challenge ? String(challenge.targetAmount / 100) : "",
      startDate: challenge?.startDate ?? format(new Date(), "yyyy-MM-dd"),
      endDate: challenge?.endDate ?? "",
      customDurationDays: challenge?.customDurationDays
        ? String(challenge.customDurationDays)
        : "",
      categoryIds: challenge?.categoryIds ?? [],
      accountId: challenge?.accountId ?? "",
      debtId: challenge?.debtId ?? "",
      accountIds: challenge?.accountIds ?? [],
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const targetCents = Math.round(parseFloat(value.targetAmount) * 100);
      const description = value.description.trim() || undefined;
      const endDate =
        value.repetition === "one_off" && value.endDate ? value.endDate : null;
      const customDurationDays =
        value.repetition === "custom" && value.customDurationDays
          ? parseInt(value.customDurationDays, 10)
          : null;

      let categoryIds: string[] = [];
      let accountId: string | null = null;
      let debtId: string | null = null;
      let scopedAccountIds: string[] = [];
      if (value.type === "spend_less") {
        categoryIds = value.categoryIds;
        scopedAccountIds = value.accountIds;
      } else if (value.type === "savings") {
        accountId = value.accountId || null;
      } else if (value.type === "pay_off_loan") {
        categoryIds = value.categoryIds;
        debtId = value.debtId || null;
        scopedAccountIds = value.accountIds;
      }

      if (isEdit && challenge) {
        updateChallenge.mutate({
          id: challenge.id,
          name: value.name.trim(),
          description: description ?? null,
          targetAmount: targetCents,
          categoryIds,
          accountId,
          debtId,
          accountIds: scopedAccountIds,
        });
      } else {
        createChallenge.mutate({
          name: value.name.trim(),
          description,
          type: value.type,
          repetition: value.repetition,
          targetAmount: targetCents,
          startDate: value.startDate,
          endDate,
          customDurationDays,
          categoryIds,
          accountId,
          debtId,
          accountIds: scopedAccountIds,
        });
      }
    },
  });

  const mutation = isEdit ? updateChallenge : createChallenge;
  const availableCategories = (categories ?? []).filter((c) => !c.archived);
  const activeAccounts = (accounts ?? []).filter((a) => !a.archived);
  const activeDebts = (debts ?? []).filter((d) => !d.archivedAt);

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
            {isEdit ? t("editChallenge") : t("createChallenge")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("editChallengeDescription")
              : t("createChallengeDescription")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            {!isEdit && (
              <form.Field name="type">
                {(field) => (
                  <Field>
                    <FieldLabel>{t("challengeType")}</FieldLabel>
                    <RadioGroup
                      value={field.state.value}
                      onValueChange={(v) => {
                        const next = v as ChallengeType;
                        field.handleChange(next);
                        if (next === "net_worth_goal") {
                          form.setFieldValue("repetition", "one_off");
                        }
                      }}
                      className="gap-2"
                    >
                      {TYPES.map((type) => (
                        <label
                          key={type}
                          htmlFor={`type-${type}`}
                          className="border-border bg-card hover:bg-accent data-[state=checked]:border-primary flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                          data-state={
                            field.state.value === type ? "checked" : undefined
                          }
                        >
                          <RadioGroupItem
                            id={`type-${type}`}
                            value={type}
                            className="mt-0.5"
                          />
                          <div className="flex-1 space-y-0.5">
                            <Label
                              htmlFor={`type-${type}`}
                              className="font-medium"
                            >
                              {t(`challengeTypes.${type}`)}
                            </Label>
                            <p className="text-muted-foreground text-xs">
                              {t(`challengeTypes.${type}Description`)}
                            </p>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </Field>
                )}
              </form.Field>
            )}

            <form.Field name="name">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("challengeNameLabel")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t("challengeNamePlaceholder")}
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

            <form.Field name="targetAmount">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("challengeTarget")}
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
                      {t("challengeTargetHelp")}
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            {!isEdit && (
              <form.Subscribe selector={(s) => s.values.type}>
                {(type) =>
                  type === "net_worth_goal" ? null : (
                    <form.Field name="repetition">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>
                            {t("challengeRepetition")}
                          </FieldLabel>
                          <Select
                            value={field.state.value}
                            onValueChange={(v) =>
                              field.handleChange(v as Repetition)
                            }
                          >
                            <SelectTrigger id={field.name}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {REPETITIONS.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {t(`challengeRepetitions.${r}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    </form.Field>
                  )
                }
              </form.Subscribe>
            )}

            {!isEdit && (
              <form.Field name="startDate">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      {t("challengeStartDate")}
                    </FieldLabel>
                    <DatePicker
                      id={field.name}
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                    />
                  </Field>
                )}
              </form.Field>
            )}

            {!isEdit && (
              <form.Subscribe selector={(s) => s.values.repetition}>
                {(repetition) => {
                  if (repetition === "one_off") {
                    return (
                      <form.Field name="endDate">
                        {(field) => {
                          const isInvalid =
                            field.state.meta.isTouched &&
                            !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                {t("challengeEndDate")}
                              </FieldLabel>
                              <DatePicker
                                id={field.name}
                                value={field.state.value}
                                onChange={field.handleChange}
                                onBlur={field.handleBlur}
                              />
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          );
                        }}
                      </form.Field>
                    );
                  }
                  if (repetition === "custom") {
                    return (
                      <form.Field name="customDurationDays">
                        {(field) => {
                          const isInvalid =
                            field.state.meta.isTouched &&
                            !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                {t("challengeCustomDurationDays")}
                              </FieldLabel>
                              <Input
                                id={field.name}
                                type="number"
                                step="1"
                                min="1"
                                placeholder={t(
                                  "challengeCustomDurationDaysPlaceholder",
                                )}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) =>
                                  field.handleChange(e.target.value)
                                }
                                aria-invalid={isInvalid}
                              />
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          );
                        }}
                      </form.Field>
                    );
                  }
                  return null;
                }}
              </form.Subscribe>
            )}

            <form.Subscribe selector={(s) => s.values.type}>
              {(type) => (
                <>
                  {(type === "spend_less" || type === "pay_off_loan") && (
                    <>
                      <form.Field name="categoryIds">
                        {(field) => {
                          const isInvalid =
                            field.state.meta.isTouched &&
                            !field.state.meta.isValid;
                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                {t("challengeCategory")}
                              </FieldLabel>
                              <CategorySelect
                                multiple
                                id={field.name}
                                value={field.state.value}
                                onChange={(v) => field.handleChange(v)}
                                categories={availableCategories}
                                mode="any"
                                aria-invalid={isInvalid}
                              />
                              {isInvalid && (
                                <FieldError errors={field.state.meta.errors} />
                              )}
                            </Field>
                          );
                        }}
                      </form.Field>

                      <form.Field name="accountIds">
                        {(field) => {
                          const selected = new Set(field.state.value);
                          return (
                            <Field>
                              <FieldLabel>{t("challengeAccounts")}</FieldLabel>
                              {activeAccounts.length === 0 ? (
                                <p className="text-muted-foreground text-xs">
                                  {t("challengeAllAccounts")}
                                </p>
                              ) : (
                                <div className="border-border bg-card flex flex-col gap-2 rounded-lg border p-3">
                                  {activeAccounts.map((a) => {
                                    const checked = selected.has(a.id);
                                    const id = `account-${a.id}`;
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
                                            const updated = new Set(
                                              field.state.value,
                                            );
                                            if (next) {
                                              updated.add(a.id);
                                            } else {
                                              updated.delete(a.id);
                                            }
                                            field.handleChange(
                                              Array.from(updated),
                                            );
                                          }}
                                          className="h-4 w-4"
                                        />
                                        <span className="text-sm">
                                          {a.name}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                              <FieldDescription>
                                {t("challengeAccountsHelp")}
                              </FieldDescription>
                            </Field>
                          );
                        }}
                      </form.Field>
                    </>
                  )}

                  {type === "savings" && (
                    <form.Field name="accountId">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>
                            {t("challengeAccount")}
                          </FieldLabel>
                          <Select
                            value={field.state.value || ""}
                            onValueChange={(v) => field.handleChange(v)}
                          >
                            <SelectTrigger id={field.name}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {activeAccounts.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    </form.Field>
                  )}

                  {type === "pay_off_loan" && (
                    <form.Field name="debtId">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>
                            {t("challengeDebt")}
                          </FieldLabel>
                          <Select
                            value={field.state.value || "__none__"}
                            onValueChange={(v) =>
                              field.handleChange(v === "__none__" ? "" : v)
                            }
                          >
                            <SelectTrigger id={field.name}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                {t("noChallengeDebt")}
                              </SelectItem>
                              {activeDebts.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldDescription>
                            {t("challengeDebtOptional")}
                          </FieldDescription>
                        </Field>
                      )}
                    </form.Field>
                  )}
                </>
              )}
            </form.Subscribe>

            <form.Field name="description">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t("challengeDescriptionLabel")}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t("challengeDescriptionPlaceholder")}
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
