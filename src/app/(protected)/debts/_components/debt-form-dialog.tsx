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
import {
  PERIOD_MONTHS,
  periodicPayment,
  type PaymentFrequency,
} from "~/server/lib/amortization";

type Debt = RouterOutputs["debt"]["list"][number];

const FREQUENCIES: PaymentFrequency[] = [
  "monthly",
  "bi_monthly",
  "quarterly",
  "semi_annual",
  "annual",
];

function formatMoney(cents: number) {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} kr.`;
}

export function DebtFormDialog({
  open,
  onOpenChange,
  debt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt?: Debt;
}) {
  const t = useTranslations("debts");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const utils = api.useUtils();
  const isEdit = debt !== undefined;

  const schema = useMemo(() => {
    const required = tValidation("required");
    return z.object({
      name: z.string().min(1, required).max(100),
      lender: z.string().min(1, required).max(100),
      principal: z
        .string()
        .refine((v) => parseFloat(v) > 0, tValidation("positiveNumber")),
      interestRate: z.string(),
      termMonths: z
        .string()
        .refine((v) => parseInt(v, 10) > 0, tValidation("positiveNumber")),
      paymentFrequency: z.enum([
        "monthly",
        "bi_monthly",
        "quarterly",
        "semi_annual",
        "annual",
      ]),
      startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, tValidation("invalid")),
      assetId: z.string(),
      note: z.string(),
    });
  }, [tValidation]);

  const createDebt = api.debt.create.useMutation({
    onSuccess: (_, variables) => {
      posthog.capture("debt_created", {
        principal_cents: variables.principal,
        term_months: variables.termMonths,
        payment_frequency: variables.paymentFrequency,
        has_linked_asset: Boolean(variables.assetId),
      });
      onOpenChange(false);
      form.reset();
      void utils.debt.list.invalidate();
      void utils.debt.summary.invalidate();
      void utils.asset.list.invalidate();
    },
  });

  const updateDebt = api.debt.update.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      void utils.debt.list.invalidate();
      void utils.debt.summary.invalidate();
      void utils.asset.list.invalidate();
    },
  });

  const { data: assets } = api.asset.list.useQuery();

  const form = useForm({
    defaultValues: {
      name: debt?.name ?? "",
      lender: debt?.lender ?? "",
      principal: debt ? String(debt.principal / 100) : "",
      interestRate: debt ? String(debt.interestRateBps / 100) : "",
      termMonths: debt ? String(debt.termMonths) : "",
      paymentFrequency: (debt?.paymentFrequency ??
        "monthly") as PaymentFrequency,
      startDate: debt?.startDate ?? format(new Date(), "yyyy-MM-dd"),
      assetId: debt?.assetId ?? "",
      note: debt?.note ?? "",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const principalCents = Math.round(parseFloat(value.principal) * 100);
      const rateBps = Math.round(parseFloat(value.interestRate || "0") * 100);
      const term = parseInt(value.termMonths, 10);
      const trimmedNote = value.note.trim();
      const assetIdOrNull = value.assetId ? value.assetId : null;

      if (isEdit) {
        updateDebt.mutate({
          id: debt.id,
          name: value.name.trim(),
          lender: value.lender.trim(),
          principal: principalCents,
          interestRateBps: rateBps,
          termMonths: term,
          paymentFrequency: value.paymentFrequency,
          startDate: value.startDate,
          assetId: assetIdOrNull,
          note: trimmedNote || null,
        });
      } else {
        createDebt.mutate({
          name: value.name.trim(),
          lender: value.lender.trim(),
          principal: principalCents,
          interestRateBps: rateBps,
          termMonths: term,
          paymentFrequency: value.paymentFrequency,
          startDate: value.startDate,
          assetId: assetIdOrNull,
          note: trimmedNote || undefined,
        });
      }
    },
  });

  const mutation = isEdit ? updateDebt : createDebt;

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
          <DialogTitle>{isEdit ? t("editDebt") : t("addDebt")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("editDebtDescription") : t("addDebtDescription")}
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
                      {t("nameLabel")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder={t("namePlaceholder")}
                      autoFocus
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="lender">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>{t("lender")}</FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder={t("lenderPlaceholder")}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="principal">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("principal")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                    />
                    <FieldDescription>{t("principalHelp")}</FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <form.Field name="interestRate">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      {t("interestRate")} (%)
                    </FieldLabel>
                    <Input
                      id={field.name}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={t("interestRatePlaceholder")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </Field>
                )}
              </form.Field>

              <form.Field name="termMonths">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        {t("termMonths")}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        type="number"
                        step="1"
                        min="1"
                        placeholder={t("termMonthsPlaceholder")}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              </form.Field>
            </div>

            <form.Field name="paymentFrequency">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t("paymentFrequency")}
                  </FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) =>
                      field.handleChange(v as PaymentFrequency)
                    }
                  >
                    <SelectTrigger id={field.name}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f} value={f}>
                          {t(`frequency.${f}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>

            <form.Field name="startDate">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>{t("startDate")}</FieldLabel>
                  <DatePicker
                    id={field.name}
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                  />
                </Field>
              )}
            </form.Field>

            <form.Subscribe
              selector={(s) => ({
                principal: s.values.principal,
                interestRate: s.values.interestRate,
                termMonths: s.values.termMonths,
                paymentFrequency: s.values.paymentFrequency,
              })}
            >
              {({ principal, interestRate, termMonths, paymentFrequency }) => {
                const principalCents = Math.round(
                  parseFloat(principal || "") * 100,
                );
                const rateBps = Math.round(
                  parseFloat(interestRate || "0") * 100,
                );
                const term = parseInt(termMonths || "", 10);
                if (
                  !Number.isFinite(principalCents) ||
                  principalCents <= 0 ||
                  !Number.isFinite(term) ||
                  term <= 0
                ) {
                  return <div />;
                }
                const payment = periodicPayment({
                  principal: principalCents,
                  interestRateBps: Number.isFinite(rateBps) ? rateBps : 0,
                  termMonths: term,
                  paymentFrequency,
                });
                const n = Math.ceil(term / PERIOD_MONTHS[paymentFrequency]);
                return (
                  <div className="border-border bg-card shadow-card rounded-lg border p-4">
                    <p className="text-muted-foreground text-xs tracking-wide uppercase">
                      {t(`paymentPerFrequency.${paymentFrequency}`)}
                    </p>
                    <p className="font-display text-foreground mt-1 text-2xl">
                      {formatMoney(payment)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t("monthlyPaymentHelp")} · {n} ×{" "}
                      {t(`frequency.${paymentFrequency}`).toLowerCase()}
                    </p>
                  </div>
                );
              }}
            </form.Subscribe>

            <form.Field name="assetId">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t("linkedAsset")}
                  </FieldLabel>
                  <Select
                    value={field.state.value || "none"}
                    onValueChange={(v) =>
                      field.handleChange(v === "none" ? "" : v)
                    }
                  >
                    <SelectTrigger id={field.name}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("noLinkedAsset")}</SelectItem>
                      {(assets ?? [])
                        .filter((a) => !a.archived)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>{t("linkedAssetHelp")}</FieldDescription>
                </Field>
              )}
            </form.Field>

            <form.Field name="note">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>{t("note")}</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t("notePlaceholder")}
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
