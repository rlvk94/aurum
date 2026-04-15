"use client";

import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  Wallet,
  Landmark,
  PiggyBank,
  Gift,
  ShieldCheck,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Checkbox } from "~/app/_components/checkbox";
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
import { cn } from "~/app/_lib/utils";

export const accountTypeIcons = {
  checking: Landmark,
  savings: PiggyBank,
  gift: Gift,
  financial_freedom: ShieldCheck,
  fixed_costs: Receipt,
  investment: TrendingUp,
  other: Wallet,
} as const;

export type AccountType = keyof typeof accountTypeIcons;

export const accountTypeKeys: Record<AccountType, string> = {
  checking: "checking",
  savings: "savings",
  gift: "gift",
  financial_freedom: "financialFreedom",
  fixed_costs: "fixedCosts",
  investment: "investment",
  other: "other",
};

const accountTypes = Object.keys(accountTypeIcons) as AccountType[];

const accountFormSchema = z.object({
  name: z.string().min(1, "Required").max(100),
  identifier: z.string().min(1, "Required").max(50),
  type: z.enum([
    "checking",
    "savings",
    "gift",
    "financial_freedom",
    "fixed_costs",
    "investment",
    "other",
  ]),
  balance: z.string(),
  includeInNetWorth: z.boolean(),
});

type Account = RouterOutputs["financialAccount"]["list"][number];

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account;
}) {
  const t = useTranslations("accounts");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();
  const isEdit = !!account;

  const createAccount = api.financialAccount.create.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      form.reset();
      void utils.financialAccount.list.invalidate();
      void utils.financialAccount.summary.invalidate();
    },
  });

  const updateAccount = api.financialAccount.update.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      void utils.financialAccount.list.invalidate();
      void utils.financialAccount.summary.invalidate();
    },
  });

  const form = useForm({
    defaultValues: {
      name: account?.name ?? "",
      identifier: account?.identifier ?? "",
      type: (account?.type as AccountType) ?? "checking",
      balance: account ? String(account.balance / 100) : "",
      includeInNetWorth: account?.includeInNetWorth ?? true,
    },
    validators: {
      onSubmit: accountFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (isEdit) {
        updateAccount.mutate({
          id: account.id,
          name: value.name.trim(),
          identifier: value.identifier.trim(),
          type: value.type,
          includeInNetWorth: value.includeInNetWorth,
        });
      } else {
        createAccount.mutate({
          name: value.name.trim(),
          identifier: value.identifier.trim(),
          type: value.type,
          balance: Math.round(parseFloat(value.balance || "0") * 100),
          includeInNetWorth: value.includeInNetWorth,
        });
      }
    },
  });

  const mutation = isEdit ? updateAccount : createAccount;

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
            {isEdit ? t("editAccount") : t("addAccount")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("editAccountDescription")
              : t("addAccountDescription")}
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
                      {t("accountName")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder={t("accountName")}
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
              name="identifier"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("accountIdentifier")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder={t("accountIdentifierPlaceholder")}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            />

            <form.Field
              name="type"
              children={(field) => (
                <Field>
                  <FieldLabel>{t("accountType")}</FieldLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {accountTypes.map((accountType) => {
                      const Icon = accountTypeIcons[accountType];
                      return (
                        <button
                          key={accountType}
                          type="button"
                          onClick={() => field.handleChange(accountType)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-all",
                            field.state.value === accountType
                              ? "border-primary bg-accent text-accent-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-primary/30",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {t(`types.${accountTypeKeys[accountType]}`)}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}
            />

            {!isEdit && (
              <form.Field
                name="balance"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      {t("openingBalance")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </Field>
                )}
              />
            )}

            <form.Field
              name="includeInNetWorth"
              children={(field) => (
                <Field orientation="horizontal">
                  <Checkbox
                    id={field.name}
                    checked={field.state.value}
                    onCheckedChange={(checked) =>
                      field.handleChange(checked === true)
                    }
                  />
                  <FieldLabel htmlFor={field.name} className="font-normal">
                    {t("includeInNetWorth")}
                  </FieldLabel>
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
