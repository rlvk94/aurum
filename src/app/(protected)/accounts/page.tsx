"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  Wallet,
  Plus,
  Landmark,
  PiggyBank,
  Gift,
  ShieldCheck,
  Receipt,
  TrendingUp,
  MoreHorizontal,
  Archive,
  Trash2,
} from "lucide-react";
import { api } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import { cn } from "~/app/_lib/utils";

const accountTypeIcons = {
  checking: Landmark,
  savings: PiggyBank,
  gift: Gift,
  financial_freedom: ShieldCheck,
  fixed_costs: Receipt,
  investment: TrendingUp,
  other: Wallet,
} as const;

type AccountType = keyof typeof accountTypeIcons;

const accountTypeKeys: Record<AccountType, string> = {
  checking: "checking",
  savings: "savings",
  gift: "gift",
  financial_freedom: "financialFreedom",
  fixed_costs: "fixedCosts",
  investment: "investment",
  other: "other",
};

const accountTypes = Object.keys(accountTypeIcons) as AccountType[];

const createAccountSchema = z.object({
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

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return value < 0 ? `-${formatted} kr.` : `${formatted} kr.`;
}

export default function AccountsPage() {
  const t = useTranslations("accounts");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();

  const { data: accounts, isLoading } = api.financialAccount.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);

  const createAccount = api.financialAccount.create.useMutation({
    onSuccess: () => {
      setCreateOpen(false);
      form.reset();
      void utils.financialAccount.list.invalidate();
      void utils.financialAccount.summary.invalidate();
    },
  });

  const updateAccount = api.financialAccount.update.useMutation({
    onSuccess: () => {
      void utils.financialAccount.list.invalidate();
      void utils.financialAccount.summary.invalidate();
    },
  });

  const deleteAccount = api.financialAccount.delete.useMutation({
    onSuccess: () => {
      void utils.financialAccount.list.invalidate();
      void utils.financialAccount.summary.invalidate();
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      identifier: "",
      type: "checking" as AccountType,
      balance: "",
      includeInNetWorth: true,
    },
    validators: {
      onSubmit: createAccountSchema,
    },
    onSubmit: async ({ value }) => {
      createAccount.mutate({
        name: value.name.trim(),
        identifier: value.identifier.trim(),
        type: value.type,
        balance: Math.round(parseFloat(value.balance || "0") * 100),
        includeInNetWorth: value.includeInNetWorth,
      });
    },
  });

  const activeAccounts = accounts?.filter((a) => !a.archived) ?? [];
  const archivedAccounts = accounts?.filter((a) => a.archived) ?? [];

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("addAccount")}
          </Button>
        }
      />

      {accounts?.length === 0 ? (
        <EmptyState icon={Wallet} message={t("emptyState")} />
      ) : (
        <div className="space-y-6">
          {activeAccounts.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeAccounts.map((account) => {
                const Icon = accountTypeIcons[account.type as AccountType];
                return (
                  <div
                    key={account.id}
                    className="flex items-start justify-between rounded-lg border border-border bg-card p-4 shadow-card"
                  >
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                        <Icon className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {account.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t(`types.${accountTypeKeys[account.type as AccountType]}`)}
                        </p>
                        <p className="mt-1 font-display text-lg text-foreground">
                          {formatAmount(account.balance)}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            updateAccount.mutate({
                              id: account.id,
                              archived: true,
                            })
                          }
                        >
                          <Archive />
                          {t("archived")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            deleteAccount.mutate({ id: account.id })
                          }
                        >
                          <Trash2 />
                          {tCommon("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}

          {archivedAccounts.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                {t("archived")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archivedAccounts.map((account) => {
                  const Icon = accountTypeIcons[account.type as AccountType];
                  return (
                    <div
                      key={account.id}
                      className="flex items-start justify-between rounded-lg border border-border bg-card p-4 opacity-60 shadow-card"
                    >
                      <div className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                          <Icon className="h-5 w-5 text-accent-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {account.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t(`types.${accountTypeKeys[account.type as AccountType]}`)}
                          </p>
                          <p className="mt-1 font-display text-lg text-foreground">
                            {formatAmount(account.balance)}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              updateAccount.mutate({
                                id: account.id,
                                archived: false,
                              })
                            }
                          >
                            <Archive />
                            {t("active")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              deleteAccount.mutate({ id: account.id })
                            }
                          >
                            <Trash2 />
                            {tCommon("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create account dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) form.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addAccount")}</DialogTitle>
            <DialogDescription>{t("emptyState")}</DialogDescription>
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
                                : "border-border bg-background text-muted-foreground hover:border-primary/30",
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

            {createAccount.error && (
              <p className="mt-4 text-sm text-destructive">{tCommon("error")}</p>
            )}

            <DialogFooter className="mt-6">
              <Button type="submit" disabled={createAccount.isPending}>
                {createAccount.isPending ? tCommon("loading") : tCommon("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
