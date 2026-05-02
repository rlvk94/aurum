"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Plus, Trash2, Wallet } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { cn } from "~/app/_lib/utils";

import { formatMoney, parseMoneyInput } from "../_lib/format";

type Income = RouterOutputs["incomePlan"]["get"]["incomes"][number];
type Plan = RouterOutputs["incomePlan"]["get"];

let optimisticIdSeq = 0;
function genOptimisticId(tag: string): string {
  optimisticIdSeq += 1;
  return `optimistic-${tag}-${optimisticIdSeq}`;
}

// Display formatter: "47000" → "47.000" (Danish grouping, integer kroner).
const krInt = new Intl.NumberFormat("da-DK", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const krDecimal = new Intl.NumberFormat("da-DK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Format an øre-cent value for the non-focused input display.
function formatAmountForField(cents: number): string {
  if (cents === 0) return "";
  const value = cents / 100;
  return Number.isInteger(value)
    ? krInt.format(value)
    : krDecimal.format(value);
}

export function IncomeEditor({
  planId,
  incomes,
}: {
  planId: string;
  incomes: Income[];
}) {
  const t = useTranslations("incomePlanner");
  const utils = api.useUtils();

  const withOptimistic = <TVars,>(
    patch: (prev: Plan, vars: TVars) => Plan,
  ) => ({
    onMutate: async (vars: TVars) => {
      await utils.incomePlan.get.cancel({ id: planId });
      const previous = utils.incomePlan.get.getData({ id: planId });
      if (previous) {
        utils.incomePlan.get.setData({ id: planId }, patch(previous, vars));
      }
      return { previous };
    },
    onError: (
      _err: unknown,
      _vars: TVars,
      ctx: { previous: Plan | undefined } | undefined,
    ) => {
      if (ctx?.previous) {
        utils.incomePlan.get.setData({ id: planId }, ctx.previous);
      }
    },
    onSettled: () => {
      void utils.incomePlan.get.invalidate({ id: planId });
      void utils.incomePlan.list.invalidate();
    },
  });

  const addIncome = api.incomePlan.addIncome.useMutation(
    withOptimistic<{ planId: string; name: string; amount: number }>(
      (prev, vars) => {
        const newIncome: Income = {
          id: genOptimisticId("income"),
          planId: vars.planId,
          name: vars.name,
          amount: vars.amount,
          sortOrder: prev.incomes.length,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return { ...prev, incomes: [...prev.incomes, newIncome] };
      },
    ),
  );

  const updateIncome = api.incomePlan.updateIncome.useMutation(
    withOptimistic<{ id: string; name?: string; amount?: number }>(
      (prev, vars) => ({
        ...prev,
        incomes: prev.incomes.map((i) =>
          i.id === vars.id
            ? {
                ...i,
                ...(vars.name !== undefined ? { name: vars.name } : {}),
                ...(vars.amount !== undefined ? { amount: vars.amount } : {}),
              }
            : i,
        ),
      }),
    ),
  );

  const deleteIncome = api.incomePlan.deleteIncome.useMutation(
    withOptimistic<{ id: string }>((prev, vars) => ({
      ...prev,
      incomes: prev.incomes.filter((i) => i.id !== vars.id),
    })),
  );

  const total = incomes.reduce((s, i) => s + i.amount, 0);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("incomeSources")}
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground/80">
            {t("incomeSourcesHint")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {t("monthlyIncomeTotal")}
          </p>
          <p className="font-display text-xl tabular-nums text-foreground">
            {formatMoney(total)}
          </p>
        </div>
      </header>

      {incomes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center">
          <Wallet className="mx-auto h-5 w-5 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {t("noIncomeYet")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("noIncomeHint")}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {incomes.map((income) => (
            <IncomeRow
              key={income.id}
              income={income}
              onUpdate={(patch) =>
                updateIncome.mutate({ id: income.id, ...patch })
              }
              onDelete={() => deleteIncome.mutate({ id: income.id })}
            />
          ))}
        </ul>
      )}

      <AddIncomeRow
        onAdd={(name, amount) =>
          addIncome.mutate({ planId, name, amount })
        }
      />
    </section>
  );
}

function IncomeRow({
  income,
  onUpdate,
  onDelete,
}: {
  income: Income;
  onUpdate: (patch: { name?: string; amount?: number }) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("incomePlanner");
  const [name, setName] = useState(income.name);
  const [amountText, setAmountText] = useState(formatAmountForField(income.amount));
  const [amountFocused, setAmountFocused] = useState(false);
  const [syncKey, setSyncKey] = useState(`${income.name}|${income.amount}`);
  const currentKey = `${income.name}|${income.amount}`;
  if (syncKey !== currentKey) {
    setSyncKey(currentKey);
    setName(income.name);
    if (!amountFocused) {
      setAmountText(formatAmountForField(income.amount));
    }
  }

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === income.name) {
      setName(income.name);
      return;
    }
    onUpdate({ name: trimmed });
  };

  const commitAmount = () => {
    setAmountFocused(false);
    const parsed = parseMoneyInput(amountText);
    if (parsed === null) {
      setAmountText(formatAmountForField(income.amount));
      return;
    }
    if (parsed !== income.amount) {
      onUpdate({ amount: parsed });
    }
    setAmountText(formatAmountForField(parsed));
  };

  return (
    <li className="group flex items-center gap-2 py-3 sm:gap-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setName(income.name);
            e.currentTarget.blur();
          }
        }}
        className="h-9 min-w-0 flex-1 border-transparent bg-transparent px-2 font-medium shadow-none hover:bg-muted focus-visible:bg-background"
      />
      <Input
        value={amountText}
        onChange={(e) => setAmountText(e.target.value)}
        onFocus={(e) => {
          setAmountFocused(true);
          // Switch to raw numeric string for easy editing.
          if (income.amount > 0) {
            setAmountText(
              (income.amount / 100).toString().replace(".", ","),
            );
          } else {
            setAmountText("");
          }
          // Select-all after paint.
          requestAnimationFrame(() => e.target.select?.());
        }}
        onBlur={commitAmount}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setAmountText(formatAmountForField(income.amount));
            e.currentTarget.blur();
          }
        }}
        inputMode="decimal"
        className="h-9 w-24 shrink-0 border-transparent bg-transparent px-2 text-right font-display tabular-nums shadow-none hover:bg-muted focus-visible:bg-background sm:w-32"
      />
      <span className="shrink-0 text-xs text-muted-foreground">kr.</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 sm:group-focus-within:opacity-100"
        onClick={onDelete}
        aria-label={t("deleteIncome")}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

function AddIncomeRow({
  onAdd,
}: {
  onAdd: (name: string, amount: number) => void;
}) {
  const t = useTranslations("incomePlanner");
  const [name, setName] = useState("");
  const [amountText, setAmountText] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const trimmed = name.trim();
    const parsed = parseMoneyInput(amountText);
    if (!trimmed || parsed === null || parsed <= 0) return;
    onAdd(trimmed, parsed);
    setName("");
    setAmountText("");
    nameRef.current?.focus();
  };

  const canSubmit =
    name.trim().length > 0 &&
    amountText.trim().length > 0 &&
    (parseMoneyInput(amountText) ?? 0) > 0;

  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-2.5 transition-colors focus-within:border-primary focus-within:bg-background sm:gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Plus className="h-3.5 w-3.5" />
      </div>
      <Input
        ref={nameRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        placeholder={t("incomeNamePlaceholder")}
        className="h-8 min-w-0 flex-1 border-transparent bg-transparent px-2 shadow-none focus-visible:bg-background"
      />
      <Input
        value={amountText}
        onChange={(e) => setAmountText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        inputMode="decimal"
        placeholder="0"
        className="h-8 w-24 shrink-0 border-transparent bg-transparent px-2 text-right font-display tabular-nums shadow-none focus-visible:bg-background sm:w-32"
      />
      <span className="shrink-0 text-xs text-muted-foreground">kr.</span>
      <Button
        size="icon"
        className={cn("h-8 w-8", !canSubmit && "opacity-40")}
        onClick={commit}
        disabled={!canSubmit}
        aria-label={t("addIncome")}
      >
        <Check className="h-4 w-4" />
      </Button>
    </div>
  );
}
