"use client";

import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { CalendarIcon, Minus, Plus } from "lucide-react";
import { format, parse } from "date-fns";
import { da, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { Calendar } from "~/app/_components/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/_components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/_components/select";
import { RadioGroup, RadioGroupItem } from "~/app/_components/radio-group";
import { Checkbox } from "~/app/_components/checkbox";
import posthog from "posthog-js";
import { CategorySelect } from "~/app/_components/category-select";
import { cn } from "~/app/_lib/utils";
import { useEntitlements } from "~/app/_hooks/use-entitlements";

type Transaction = RouterOutputs["transaction"]["list"]["items"][number];
type Account = RouterOutputs["financialAccount"]["list"][number];

type TxType = "expense" | "income";

const typeOptions: Array<{
  value: TxType;
  icon: typeof Minus;
  selected: string;
}> = [
  {
    value: "expense",
    icon: Minus,
    selected: "border-expense bg-expense-muted text-expense",
  },
  {
    value: "income",
    icon: Plus,
    selected: "border-income bg-income-muted text-income",
  },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const transactionFormSchema = z.object({
  type: z.enum(["expense", "income"]),
  accountId: z.string().uuid("Account required"),
  amount: z.string().refine(
    (v) => {
      const n = parseFloat(v);
      return !isNaN(n) && n > 0;
    },
    { message: "Amount must be greater than 0" },
  ),
  date: z.string().regex(ISO_DATE, "Required"),
  description: z.string().min(1, "Required").max(500),
  note: z.string(),
  categoryId: z.string(),
  projectId: z.string(),
  excludedFromCalculations: z.boolean(),
});

function today(): string {
  const d = new Date();
  return format(d, "yyyy-MM-dd");
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction;
  accounts: Account[];
}) {
  const t = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const tProjects = useTranslations("projects");
  const locale = useLocale();
  const utils = api.useUtils();
  const isEdit = transaction !== undefined;
  const { has: hasFeature } = useEntitlements();
  const hasProjects = hasFeature("projects");
  const { data: categories = [] } = api.category.list.useQuery();
  const { data: projects = [] } = api.project.list.useQuery(
    { includeArchived: false },
    { enabled: hasProjects },
  );

  const createTx = api.transaction.create.useMutation({
    onSuccess: (_, variables) => {
      posthog.capture("transaction_created", {
        type: variables.type,
        amount_cents: variables.amount,
        has_category: Boolean(variables.categoryId),
      });
      onOpenChange(false);
      form.reset();
      void utils.transaction.list.invalidate();
      void utils.financialAccount.summary.invalidate();
    },
  });

  const updateTx = api.transaction.update.useMutation({
    onSuccess: (_, variables) => {
      posthog.capture("transaction_updated", {
        type: variables.type,
        amount_cents: variables.amount,
        has_category: Boolean(variables.categoryId),
      });
      onOpenChange(false);
      void utils.transaction.list.invalidate();
      void utils.financialAccount.summary.invalidate();
    },
  });

  const form = useForm({
    defaultValues: {
      type: (transaction?.type as TxType) ?? "expense",
      accountId: transaction?.accountId ?? accounts[0]?.id ?? "",
      amount: transaction ? String(transaction.amount / 100) : "",
      date: transaction?.date ?? today(),
      description: transaction?.description ?? "",
      note: transaction?.note ?? "",
      categoryId: transaction?.categoryId ?? "",
      projectId: transaction?.projectId ?? "",
      excludedFromCalculations: transaction?.excludedFromCalculations ?? false,
    },
    validators: {
      onSubmit: transactionFormSchema,
    },
    onSubmit: async ({ value }) => {
      const amountCents = Math.round(parseFloat(value.amount) * 100);
      const trimmedNote = value.note.trim();
      const categoryId = value.categoryId ? value.categoryId : null;
      const projectId = value.projectId ? value.projectId : null;
      if (isEdit) {
        updateTx.mutate({
          id: transaction.id,
          type: value.type,
          amount: amountCents,
          date: value.date,
          description: value.description.trim(),
          note: trimmedNote || null,
          categoryId,
          projectId,
          excludedFromCalculations: value.excludedFromCalculations,
        });
      } else {
        createTx.mutate({
          accountId: value.accountId,
          type: value.type,
          amount: amountCents,
          date: value.date,
          description: value.description.trim(),
          note: trimmedNote || undefined,
          categoryId: categoryId ?? undefined,
          projectId,
          excludedFromCalculations: value.excludedFromCalculations,
        });
      }
    },
  });

  const mutation = isEdit ? updateTx : createTx;
  const dateLocale = locale === "da" ? da : enUS;

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
            {isEdit ? t("editTransaction") : t("addTransaction")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("editTransactionDescription")
              : t("addTransactionDescription")}
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
              name="type"
              children={(field) => (
                <Field>
                  <FieldLabel>{tCommon("type")}</FieldLabel>
                  <RadioGroup
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as TxType)}
                    className="grid grid-cols-2 gap-2"
                  >
                    {typeOptions.map((opt) => {
                      const Icon = opt.icon;
                      const selected = field.state.value === opt.value;
                      return (
                        <label
                          key={opt.value}
                          htmlFor={`type-${opt.value}`}
                          className={cn(
                            "flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-all",
                            selected
                              ? opt.selected
                              : "border-border text-muted-foreground hover:border-primary/30",
                          )}
                        >
                          <RadioGroupItem
                            value={opt.value}
                            id={`type-${opt.value}`}
                            className="sr-only"
                          />
                          <Icon className="h-4 w-4" />
                          {t(opt.value)}
                        </label>
                      );
                    })}
                  </RadioGroup>
                </Field>
              )}
            />

            <form.Field
              name="accountId"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>{t("account")}</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={field.handleChange}
                      disabled={isEdit}
                    >
                      <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                        <SelectValue placeholder={t("account")} />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
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
              name="amount"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>{t("amount")}</FieldLabel>
                    <Input
                      id={field.name}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
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
            />

            <form.Field
              name="date"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                const dateValue = field.state.value
                  ? parse(field.state.value, "yyyy-MM-dd", new Date())
                  : undefined;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {tCommon("date")}
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
                            : t("pickDate")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateValue}
                          onSelect={(d) => {
                            if (d) field.handleChange(format(d, "yyyy-MM-dd"));
                          }}
                          locale={dateLocale}
                        />
                      </PopoverContent>
                    </Popover>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            />

            <form.Field
              name="description"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("descriptionLabel")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder={t("descriptionPlaceholder")}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            />

            <form.Field
              name="categoryId"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {tCommon("category")}
                  </FieldLabel>
                  <CategorySelect
                    id={field.name}
                    value={field.state.value || null}
                    onChange={(v) => field.handleChange(v ?? "")}
                    categories={categories}
                    mode="leaf-only"
                    emptyOption="none"
                    placeholder={tCommon("category")}
                  />
                </Field>
              )}
            />

            {hasProjects && (
              <form.Field
                name="projectId"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      {tProjects("filterLabel")}
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
                          {tProjects("noProject")}
                        </SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="mr-1">{p.emoji}</span>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            )}

            <form.Field
              name="note"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>{t("noteLabel")}</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t("notePlaceholder")}
                  />
                </Field>
              )}
            />

            <form.Field
              name="excludedFromCalculations"
              children={(field) => (
                <Field>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={(v) => field.handleChange(v === true)}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <FieldLabel htmlFor={field.name}>
                        {t("excludedFromCalculationsLabel")}
                      </FieldLabel>
                      <p className="text-muted-foreground text-xs">
                        {t("excludedFromCalculationsHelp")}
                      </p>
                    </div>
                  </div>
                </Field>
              )}
            />
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
