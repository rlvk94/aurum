"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Check, CheckCircle2, Copy, Plus, Trash2 } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import {
  PROJECT_PALETTES,
  type ProjectPalette,
} from "~/app/(protected)/projects/_lib/format";
import { cn } from "~/app/_lib/utils";

import {
  bpsFromCents,
  formatMoney,
  formatPercentBps,
  parseMoneyInput,
  parsePercentInput,
} from "../_lib/format";

type Line = RouterOutputs["incomePlan"]["get"]["lines"][number];
type Income = RouterOutputs["incomePlan"]["get"]["incomes"][number];
type Plan = RouterOutputs["incomePlan"]["get"];

const DEFAULT_COLOR: ProjectPalette = "gold";

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
  allocatedBps,
}: {
  planId: string;
  lines: Line[];
  incomes: Income[];
  totalIncome: number;
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
      target: string;
      targetColor: ProjectPalette;
      allocationType: "percentage" | "fixed";
      value: number;
    }>((prev, vars) => {
      const newLine: Line = {
        id: genOptimisticId("line"),
        planId: vars.planId,
        target: vars.target,
        targetColor: vars.targetColor,
        allocationType: vars.allocationType,
        value: vars.value,
        note: null,
        sortOrder: prev.lines.length,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return { ...prev, lines: [...prev.lines, newLine] };
    }),
  );

  const updateLine = api.incomePlan.updateLine.useMutation(
    withOptimistic<{
      id: string;
      target?: string;
      targetColor?: ProjectPalette;
      allocationType?: "percentage" | "fixed";
      value?: number;
    }>((prev, vars) => ({
      ...prev,
      lines: prev.lines.map((l) => {
        if (l.id !== vars.id) return l;
        const patch = { ...l };
        if (vars.target !== undefined) patch.target = vars.target;
        if (vars.targetColor !== undefined) patch.targetColor = vars.targetColor;
        if (vars.allocationType !== undefined) patch.allocationType = vars.allocationType;
        if (vars.value !== undefined) patch.value = vars.value;
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
    addLine.mutate({
      planId,
      target: t("newTargetDefault"),
      targetColor: DEFAULT_COLOR,
      allocationType: "percentage",
      value: 0,
    });
  };

  const showPerSource = incomes.length >= 2 && totalIncome > 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
      <header className="mb-5 flex items-start justify-between gap-3">
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

      {lines.length === 0 ? (
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
  showPerSource,
  onUpdate,
  onDelete,
}: {
  line: Line;
  incomes: Income[];
  totalIncome: number;
  showPerSource: boolean;
  onUpdate: (patch: {
    target?: string;
    targetColor?: ProjectPalette;
    allocationType?: "percentage" | "fixed";
    value?: number;
  }) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("incomePlanner");
  const [valueText, setValueText] = useState(() => initialValueText(line));
  const [targetText, setTargetText] = useState(line.target);
  const [syncKey, setSyncKey] = useState(
    `${line.allocationType}|${line.value}|${line.target}`,
  );
  const currentKey = `${line.allocationType}|${line.value}|${line.target}`;
  if (syncKey !== currentKey) {
    setSyncKey(currentKey);
    setValueText(initialValueText(line));
    setTargetText(line.target);
  }

  const palette = (line.targetColor as ProjectPalette) ?? DEFAULT_COLOR;
  const stripeColor = `var(--project-cover-${palette}-to)`;

  const isPercentage = line.allocationType === "percentage";

  const commitTarget = () => {
    const trimmed = targetText.trim();
    if (!trimmed || trimmed === line.target) {
      setTargetText(line.target);
      return;
    }
    onUpdate({ target: trimmed });
  };

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
        {/* Row 1 (mobile) / inline (desktop): color swatch picker + target input */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:contents">
          <ColorSwatchPicker
            value={palette}
            stripeColor={stripeColor}
            onChange={(next) => onUpdate({ targetColor: next })}
            label={t("targetColor")}
          />
          <Input
            value={targetText}
            onChange={(e) => setTargetText(e.target.value)}
            onBlur={commitTarget}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setTargetText(line.target);
                e.currentTarget.blur();
              }
            }}
            placeholder={t("targetPlaceholder")}
            className="h-9 min-w-0 flex-1 border-transparent bg-transparent px-2 font-medium shadow-none hover:bg-muted focus-visible:bg-background"
          />
        </div>

        {/* Row 2 (mobile) / inline (desktop): type toggle + value + delete */}
        <div className="flex items-center gap-2 sm:contents">
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

          {/* Value input + counterpart */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
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
              className="h-9 w-20 shrink-0 border-transparent bg-muted px-2 text-right font-display tabular-nums shadow-none focus-visible:bg-background sm:w-24"
            />
            <span className="min-w-[4rem] text-right text-xs text-muted-foreground tabular-nums sm:min-w-[4.5rem]">
              {counterpart}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 shrink-0 text-muted-foreground transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 sm:group-focus-within:opacity-100"
            aria-label={t("remove")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Per-source breakdown — shown when there are multiple income sources
          so the user can see (and copy) the exact amount drawn from each one. */}
      {showPerSource && perSource.length > 0 && (
        <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-2 sm:ml-5">
          <p className="px-2 pb-1.5 pt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {t("perSourceTitle")}
          </p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {perSource.map((ps) => (
              <li
                key={ps.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-background"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                  {ps.name}
                </span>
                <span className="shrink-0 font-display text-sm tabular-nums text-foreground">
                  {formatMoney(ps.cents)}
                </span>
                <CopyAmountButton cents={ps.cents} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Inline 8-color swatch picker. The trigger is a vertical stripe matching the
// allocation row's accent; click to expand a row of palette swatches.
function ColorSwatchPicker({
  value,
  stripeColor,
  onChange,
  label,
}: {
  value: ProjectPalette;
  stripeColor: string;
  onChange: (next: ProjectPalette) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={(e) => {
          // Close when focus leaves the swatch + popover.
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
        className="h-9 w-1.5 rounded-full transition-all hover:w-2 sm:h-10"
        style={{ backgroundColor: stripeColor }}
      />
      {open && (
        <div
          className="absolute left-0 top-full z-20 mt-2 flex gap-1 rounded-md border border-border bg-popover p-1.5 shadow-elevated"
          onMouseDown={(e) => e.preventDefault()}
        >
          {PROJECT_PALETTES.map((p) => {
            const selected = p === value;
            return (
              <button
                key={p}
                type="button"
                aria-label={p}
                aria-pressed={selected}
                data-project-palette={p}
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
                className={cn(
                  "h-6 w-6 rounded-full transition",
                  selected
                    ? "ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                    : "opacity-90 hover:opacity-100",
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function CopyAmountButton({ cents }: { cents: number }) {
  const t = useTranslations("incomePlanner");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const value = cents / 100;
    const text = Number.isInteger(value)
      ? String(value)
      : value.toFixed(2).replace(".", ",");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write can fail (HTTP context, permissions). No-op for now.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
        copied && "text-income hover:text-income",
      )}
      aria-label={copied ? t("copied") : t("copyAmount")}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
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
