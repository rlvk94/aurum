"use client";

import { useEffect } from "react";
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
  Users,
  Lock,
} from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Checkbox } from "~/app/_components/checkbox";
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

type Visibility = "shared" | "private";

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
  visibility: z.enum(["shared", "private"]),
  accessUserIds: z.array(z.string()),
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
  const tFamily = useTranslations("family");
  const utils = api.useUtils();
  const isEdit = !!account;

  const { data: session } = api.user.me.useQuery();
  const { data: members = [] } = api.family.listMembers.useQuery();
  const { data: existingAccess } = api.financialAccount.listAccess.useQuery(
    { accountId: account?.id ?? "" },
    {
      enabled: isEdit && account?.visibility === "private" && open,
    },
  );

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
      if (account?.id) {
        void utils.financialAccount.listAccess.invalidate({
          accountId: account.id,
        });
      }
    },
  });

  const form = useForm({
    defaultValues: {
      name: account?.name ?? "",
      identifier: account?.identifier ?? "",
      type: (account?.type as AccountType) ?? "checking",
      balance: account ? String(account.balance / 100) : "",
      includeInNetWorth: account?.includeInNetWorth ?? true,
      visibility: (account?.visibility ?? "shared") as Visibility,
      accessUserIds: [] as string[],
    },
    validators: {
      onSubmit: accountFormSchema,
    },
    onSubmit: async ({ value }) => {
      const isPrivate = value.visibility === "private";
      const sharedPayload = {
        visibility: value.visibility,
        accessUserIds: isPrivate ? value.accessUserIds : [],
      };
      if (isEdit) {
        updateAccount.mutate({
          id: account.id,
          name: value.name.trim(),
          identifier: value.identifier.trim(),
          type: value.type,
          includeInNetWorth: value.includeInNetWorth,
          ...sharedPayload,
        });
      } else {
        createAccount.mutate({
          name: value.name.trim(),
          identifier: value.identifier.trim(),
          type: value.type,
          balance: Math.round(parseFloat(value.balance || "0") * 100),
          includeInNetWorth: value.includeInNetWorth,
          ...sharedPayload,
        });
      }
    },
  });

  // Populate access list when editing a private account — once the access
  // list loads, seed the form so pre-existing grants are preserved.
  useEffect(() => {
    if (isEdit && existingAccess) {
      form.setFieldValue("accessUserIds", existingAccess);
    }
  }, [isEdit, existingAccess, form]);

  const mutation = isEdit ? updateAccount : createAccount;
  const currentUserId = session?.id;

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
              name="visibility"
              children={(field) => (
                <Field>
                  <FieldLabel>{t("visibility")}</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {(["shared", "private"] as const).map((value) => {
                      const Icon = value === "shared" ? Users : Lock;
                      const isSelected = field.state.value === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => field.handleChange(value)}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                            isSelected
                              ? "border-primary bg-accent text-accent-foreground"
                              : "border-border bg-card hover:border-primary/30",
                          )}
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">
                              {t(
                                value === "shared"
                                  ? "visibilityShared"
                                  : "visibilityPrivate",
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t(
                                value === "shared"
                                  ? "visibilitySharedDescription"
                                  : "visibilityPrivateDescription",
                              )}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}
            />

            <form.Subscribe selector={(s) => s.values.visibility}>
              {(visibility) =>
                visibility === "private" && (
                  <form.Field
                    name="accessUserIds"
                    children={(field) => {
                      const selected = new Set(field.state.value);
                      return (
                        <Field>
                          <FieldLabel>{t("sharedWith")}</FieldLabel>
                          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                            {members.map((m) => {
                              const isSelf = m.userId === currentUserId;
                              const checked = isSelf || selected.has(m.userId);
                              const id = `access-${m.userId}`;
                              return (
                                <label
                                  key={m.userId}
                                  htmlFor={id}
                                  className={cn(
                                    "flex items-center gap-3",
                                    isSelf
                                      ? "cursor-not-allowed opacity-80"
                                      : "cursor-pointer",
                                  )}
                                >
                                  <Checkbox
                                    id={id}
                                    checked={checked}
                                    disabled={isSelf}
                                    onCheckedChange={(next) => {
                                      if (isSelf) return;
                                      const updated = new Set(
                                        field.state.value,
                                      );
                                      if (next) {
                                        updated.add(m.userId);
                                      } else {
                                        updated.delete(m.userId);
                                      }
                                      field.handleChange(Array.from(updated));
                                    }}
                                    className="h-4 w-4"
                                  />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">
                                      {m.name}
                                      {isSelf && (
                                        <span className="ml-1 text-xs text-muted-foreground">
                                          ({t("you")})
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {m.role === "owner"
                                        ? tFamily("owner")
                                        : tFamily("member")}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                          <FieldDescription>
                            {t("sharedWithHelp")}
                          </FieldDescription>
                        </Field>
                      );
                    }}
                  />
                )
              }
            </form.Subscribe>

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
