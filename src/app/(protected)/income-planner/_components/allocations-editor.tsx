"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, Plus, Trash2, Wallet } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/_components/select";
import { cn } from "~/app/_lib/utils";

import {
  ACCOUNT_TYPE_ICONS,
  colorForAccountType,
  type AccountType,
} from "../_lib/allocation-colors";
import {
  bpsFromCents,
  formatMoney,
  formatPercentBps,
  parseMoneyInput,
  parsePercentInput,
} from "../_lib/format";

type Line = RouterOutputs["incomePlan"]["get"]["lines"][number];
type Income = RouterOutputs["incomePlan"]["get"]["incomes"][number];
type Account = RouterOutputs["financialAccount"]["list"][number];
type Plan = RouterOutputs["incomePlan"]["get"];

// Monotonic counter for optimistic placeholder ids — kept at module scope so
// React's ref-purity lint rule doesn't complain about `useRef().current += 1`
// inside a mutation callback.
let optimisticIdSeq = 0;
function genOptimisticId(tag: string): string {
  optimisticIdSeq += 1;
  return `optimistic-${tag}-${optimisticIdSeq}`;
}

export function AllocationsEditor({
  planId,
  lines,
  incomes,
  totalIncome,
  accounts,
  allocatedBps,
}: {
  planId: string;
  lines: Line[];
  incomes: Income[];
  totalIncome: number;
  accounts: Account[];
  allocatedBps: number;
}) {
  const t = useTranslations("incomePlanner");
  const utils = api.useUtils();

  // ── Optimistic-update helpers ─────────────────────────────────────────────
  // All mutations patch the `incomePlan.get` cache immediately so edits feel
  // instant, then revalidate on settle.
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

  const addLine = api.incomePlan.addLine.useMutation(
    withOptimistic<{
      planId: string;
      accountId?: string | null;
      allocationType: "percentage" | "fixed";
      value: number;
    }>((prev, vars) => {
      const acc = accounts.find((a) => a.id === vars.accountId);
      const newLine: Line = {
        id: genOptimisticId("line"),
        planId: vars.planId,
        accountId: vars.accountId ?? null,
        allocationType: vars.allocationType,
        value: vars.value,
        note: null,
        sortOrder: prev.lines.length,
        createdAt: new Date(),
        updatedAt: new Date(),
        accountName: acc?.name ?? null,
        accountType: (acc?.type as AccountType | undefined) ?? null,
        accountArchived: acc?.archived ?? null,
      };
      return { ...prev, lines: [...prev.lines, newLine] };
    }),
  );

  const updateLine = api.incomePlan.updateLine.useMutation(
    withOptimistic<{
      id: string;
      accountId?: string | null;
      allocationType?: "percentage" | "fixed";
      value?: number;
    }>((prev, vars) => ({
      ...prev,
      lines: prev.lines.map((l) => {
        if (l.id !== vars.id) return l;
        const patch = { ...l };
        if (vars.allocationType !== undefined) patch.allocationType = vars.allocationType;
        if (vars.value !== undefined) patch.value = vars.value;
        if (vars.accountId !== undefined) {
          patch.accountId = vars.accountId;
          const acc = accounts.find((a) => a.id === vars.accountId);
          patch.accountName = acc?.name ?? null;
          patch.accountType = (acc?.type as AccountType | null | undefined) ?? null;
          patch.accountArchived = acc?.archived ?? null;
        }
        return patch;
      }),
    })),
  );

  const deleteLine = api.incomePlan.deleteLine.useMutation(
    withOptimistic<{ id: string }>((prev, vars) => ({
      ...prev,
      lines: prev.lines.filter((l) => l.id !== vars.id),
    })),
  );

  const overAllocated = allocatedBps > 10_050;
  const unallocatedBps = Math.max(0, 10_000 - Math.min(10_000, allocatedBps));
  const unallocatedCents = Math.round((totalIncome * unallocatedBps) / 10_000);
  const overBps = Math.max(0, allocatedBps - 10_000);
  const overCents = Math.round((totalIncome * overBps) / 10_000);

  const handleAdd = () => {
    if (accounts.length === 0) return;
    const firstAccount = accounts[0]!;
    addLine.mutate({
      planId,
      accountId: firstAccount.id,
      allocationType: "percentage",
      value: 0,
    });
  };

  const showPerSource = incomes.length >= 2 && totalIncome > 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("allocations")}
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground/80">
            {t("allocationsHint")}
          </p>
        </div>
      </header>

      {/* Prominent allocation-status banner */}
      {(lines.length > 0 || totalIncome > 0) && (
        <AllocationStatus
          overAllocated={overAllocated}
          allocatedBps={Math.min(10_000, allocatedBps)}
          unallocatedCents={unallocatedCents}
          overCents={overCents}
          totalIncome={totalIncome}
        />
      )}

      {accounts.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border px-6 py-8 text-center">
          <Wallet className="mx-auto h-5 w-5 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {t("noAccountsHint")}
          </p>
          <Link
            href="/accounts"
            className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
          >
            {t("goToAccounts")} →
          </Link>
        </div>
      ) : lines.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border px-6 py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {t("noAllocationsYet")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("noAllocationsHint")}
          </p>
          <Button className="mt-4" size="sm" onClick={handleAdd}>
            <Plus />
            {t("addAllocation")}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {lines.map((line) => (
            <AllocationRow
              key={line.id}
              line={line}
              incomes={incomes}
              totalIncome={totalIncome}
              accounts={accounts}
              showPerSource={showPerSource}
              onUpdate={(patch) =>
                updateLine.mutate({ id: line.id, ...patch })
              }
              onDelete={() => deleteLine.mutate({ id: line.id })}
            />
          ))}
          <Button
            variant="outline"
            className="mt-2 w-full border-dashed"
            onClick={handleAdd}
          >
            <Plus />
            {t("addAllocation")}
          </Button>
        </div>
      )}
    </section>
  );
}

function AllocationStatus({
  overAllocated,
  allocatedBps,
  unallocatedCents,
  overCents,
  totalIncome,
}: {
  overAllocated: boolean;
  allocatedBps: number;
  unallocatedCents: number;
  overCents: number;
  totalIncome: number;
}) {
  const t = useTranslations("incomePlanner");

  const fullyAllocated = allocatedBps === 10_000 && !overAllocated;

  if (overAllocated) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-expense/30 bg-expense/5 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-expense/10 text-expense">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-expense">
            {t("overAllocated")}
          </p>
          <p className="mt-0.5 font-display text-xl tabular-nums text-foreground">
            {formatMoney(overCents)}
          </p>
        </div>
      </div>
    );
  }

  if (fullyAllocated && totalIncome > 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-income/30 bg-income/5 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-income/10 text-income">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-income">
            {t("allocatedPercent", { percent: 100 })}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("fullyAllocatedHint")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-4",
        unallocatedCents > 0
          ? "border-warning/30 bg-warning/5"
          : "border-border bg-muted/40",
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("unallocated")}
        </p>
        <p className="mt-0.5 font-display text-2xl tabular-nums text-foreground">
          {formatMoney(unallocatedCents)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">
          {formatPercentBps(allocatedBps)} {t("allocatedLower")}
        </p>
        <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${allocatedBps / 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function AllocationRow({
  line,
  incomes,
  totalIncome,
  accounts,
  showPerSource,
  onUpdate,
  onDelete,
}: {
  line: Line;
  incomes: Income[];
  totalIncome: number;
  accounts: Account[];
  showPerSource: boolean;
  onUpdate: (patch: {
    accountId?: string | null;
    allocationType?: "percentage" | "fixed";
    value?: number;
  }) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("incomePlanner");
  const [valueText, setValueText] = useState(() => initialValueText(line));
  const [syncKey, setSyncKey] = useState(`${line.allocationType}|${line.value}`);
  const currentKey = `${line.allocationType}|${line.value}`;
  if (syncKey !== currentKey) {
    setSyncKey(currentKey);
    setValueText(initialValueText(line));
  }

  const color = colorForAccountType(line.accountType as AccountType | null);
  const Icon = line.accountType
    ? ACCOUNT_TYPE_ICONS[line.accountType as AccountType]
    : null;

  const isPercentage = line.allocationType === "percentage";

  const commitValue = () => {
    const parsed = isPercentage
      ? parsePercentInput(valueText)
      : parseMoneyInput(valueText);
    if (parsed === null || parsed < 0) {
      setValueText(initialValueText(line));
      return;
    }
    if (parsed === line.value) return;
    if (isPercentage && parsed > 10_000) {
      onUpdate({ value: 10_000 });
      setValueText("100");
      return;
    }
    onUpdate({ value: parsed });
  };

  const setType = (nextType: "percentage" | "fixed") => {
    if (nextType === line.allocationType) return;
    let nextValue: number;
    if (nextType === "fixed") {
      // percentage → fixed: convert current bps to cents at current total
      nextValue = Math.round((totalIncome * line.value) / 10_000);
    } else {
      // fixed → percentage: derive bps from current ratio
      nextValue = Math.min(10_000, bpsFromCents(line.value, totalIncome));
    }
    onUpdate({ allocationType: nextType, value: nextValue });
  };

  // ── Derived displays: routed through the same rounding path as the bar ──
  const computedCents = isPercentage
    ? Math.round((totalIncome * line.value) / 10_000)
    : line.value;
  const derivedBps = isPercentage
    ? line.value
    : bpsFromCents(line.value, totalIncome);

  const counterpart = isPercentage
    ? t("equalsAmount", { amount: formatMoney(computedCents) })
    : totalIncome > 0
      ? `≈ ${formatPercentBps(derivedBps)}`
      : "";

  // Per-source breakdown
  const perSource = incomes.map((inc) => {
    let cents: number;
    if (isPercentage) {
      cents = Math.round((inc.amount * line.value) / 10_000);
    } else if (totalIncome > 0) {
      cents = Math.round((line.value * inc.amount) / totalIncome);
    } else {
      cents = 0;
    }
    return { id: inc.id, name: inc.name, cents };
  });

  return (
    <div className="group relative rounded-xl border border-border bg-background p-3 transition-colors hover:border-foreground/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {/* Color stripe */}
        <div
          aria-hidden
          className="h-1 w-8 shrink-0 rounded-full sm:h-10 sm:w-1"
          style={{ backgroundColor: color.bg }}
        />

        {/* Account picker */}
        <Select
          value={line.accountId ?? ""}
          onValueChange={(v) => onUpdate({ accountId: v || null })}
        >
          <SelectTrigger className="h-9 min-w-0 flex-1 border-transparent bg-transparent shadow-none hover:bg-muted data-[state=open]:bg-muted">
            <SelectValue placeholder={t("pickAccount")}>
              <span className="flex items-center gap-2 truncate">
                {Icon ? (
                  <Icon className="h-4 w-4 shrink-0" style={{ color: color.bg }} />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/30" />
                )}
                <span className="truncate">
                  {line.accountName ?? t("accountDeleted")}
                </span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => {
              const AIcon = ACCOUNT_TYPE_ICONS[a.type as AccountType];
              const aColor = colorForAccountType(a.type as AccountType);
              return (
                <SelectItem key={a.id} value={a.id}>
                  <span className="flex items-center gap-2">
                    <AIcon className="h-4 w-4" style={{ color: aColor.bg }} />
                    <span>{a.name}</span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Segmented type toggle */}
        <div className="inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-muted/60 p-0.5">
          <button
            type="button"
            onClick={() => setType("percentage")}
            className={cn(
              "inline-flex h-full items-center justify-center rounded-[5px] px-2.5 text-xs font-medium tabular-nums transition-colors",
              isPercentage
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={isPercentage}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => setType("fixed")}
            className={cn(
              "inline-flex h-full items-center justify-center rounded-[5px] px-2.5 text-xs font-medium transition-colors",
              !isPercentage
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={!isPercentage}
          >
            kr.
          </button>
        </div>

        {/* Value input */}
        <div className="flex items-center gap-2">
          <Input
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
            onBlur={commitValue}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setValueText(initialValueText(line));
                e.currentTarget.blur();
              }
            }}
            inputMode="decimal"
            placeholder="0"
            className="h-9 w-24 border-transparent bg-muted px-2 text-right font-display tabular-nums shadow-none focus-visible:bg-background"
          />
          <span className="min-w-[4.5rem] text-right text-xs text-muted-foreground tabular-nums">
            {counterpart}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
          aria-label={t("remove")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Per-source breakdown */}
      {showPerSource && perSource.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-5 sm:pl-5">
          {perSource.map((ps) => (
            <span
              key={ps.id}
              className="inline-flex items-center gap-1.5 rounded-md bg-muted/70 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              <span className="font-medium text-foreground">{ps.name}</span>
              <span className="tabular-nums">{formatMoney(ps.cents)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function initialValueText(line: Line): string {
  if (line.allocationType === "percentage") {
    // basis points → display percent, strip trailing zeros
    const pct = line.value / 100;
    return Number.isInteger(pct)
      ? String(pct)
      : pct.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
  }
  const value = line.value / 100;
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(".", ",");
}
