"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/_components/popover";
import {
  formatKronerInt,
  formatMoney,
  parseMoneyInput,
} from "~/app/(protected)/income-planner/_lib/format";
import {
  cellState,
  fillClass,
  trackClass,
  varianceTextClass,
} from "../../_lib/budget-format";

type Props = {
  planned: number;
  actual: number;
  monthLabel: string;
  readOnly?: boolean;
  isCurrent?: boolean;
  onSave: (amountCents: number) => void;
};

export function BudgetCell({
  planned,
  actual,
  monthLabel,
  readOnly,
  isCurrent,
  onSave,
}: Props) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setValue(planned > 0 ? formatKronerInt(planned / 100) : "");
      requestAnimationFrame(() => inputRef.current?.select());
    }
    setOpen(next);
  };

  const state = cellState(planned, actual);

  const ratio = planned > 0 ? actual / planned : actual > 0 ? 1 : 0;
  const fillWidthPct = Math.min(100, Math.max(0, ratio * 100));
  const overshootPct =
    planned > 0 && actual > planned
      ? Math.min(40, ((actual - planned) / planned) * 100)
      : 0;

  const submit = () => {
    const parsed = parseMoneyInput(value);
    if (parsed === null || parsed < 0) return;
    onSave(parsed);
    setOpen(false);
  };

  const variance = actual - planned;
  const variancePrefix = variance > 0 ? "+" : variance < 0 ? "−" : "";

  // Stack planned / bar / variance vertically so nothing competes for
  // horizontal space — month columns are too narrow to carry two numbers on
  // the same row.
  const SparkBar = (
    <div className="flex flex-col gap-1">
      <span
        className={`almanac-numerals truncate text-[11px] leading-tight ${
          planned > 0 ? "text-foreground" : "text-muted-foreground/60"
        }`}
      >
        {planned > 0 ? formatMoney(planned) : "—"}
      </span>
      <div
        className={`relative h-[4px] overflow-hidden rounded-full ${trackClass(
          state,
        )}`}
      >
        {fillWidthPct > 0 && (
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ease-out ${fillClass(
              state,
            )}`}
            style={{ width: `${fillWidthPct}%` }}
          />
        )}
        {overshootPct > 0 && (
          <div
            className="bg-expense/80 absolute inset-y-0 right-0"
            style={{ width: `${overshootPct}%` }}
          />
        )}
      </div>
      {actual > 0 && (
        <span
          className={`almanac-numerals truncate text-[10px] leading-none ${varianceTextClass(
            planned,
            actual,
          )}`}
        >
          {variancePrefix}
          {formatMoney(Math.abs(variance))}
        </span>
      )}
    </div>
  );

  if (readOnly) {
    return (
      <div
        className={`flex h-full flex-col justify-center px-2.5 py-2 ${
          isCurrent ? "bg-primary/[0.03]" : ""
        }`}
      >
        {SparkBar}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${monthLabel}: ${t("cellEdit")}`}
          className={`hover:bg-primary/[0.04] focus-visible:ring-primary/60 focus-visible:ring-offset-background flex h-full w-full flex-col justify-center gap-0 rounded-[6px] px-2.5 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none ${
            isCurrent ? "bg-primary/[0.03]" : ""
          }`}
        >
          {SparkBar}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4" align="center">
        <div className="space-y-4">
          <div>
            <p className="almanac-smallcaps text-muted-foreground text-[10px]">
              {monthLabel}
            </p>
            <p className="font-display text-foreground almanac-numerals mt-1 text-2xl">
              {planned > 0 ? formatMoney(planned) : "—"}
            </p>
            {actual > 0 && (
              <p
                className={`almanac-numerals mt-0.5 text-xs ${varianceTextClass(
                  planned,
                  actual,
                )}`}
              >
                {t("cellActual")} · {formatMoney(actual)}
                {variance !== 0 && (
                  <span className="text-muted-foreground ml-1">
                    ({variancePrefix}
                    {formatMoney(Math.abs(variance))})
                  </span>
                )}
              </p>
            )}
          </div>
          <div>
            <label
              className="almanac-smallcaps text-muted-foreground text-[9px]"
              htmlFor="cell-amount"
            >
              {t("cellPlanned")}
            </label>
            <Input
              ref={inputRef}
              id="cell-amount"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                }
              }}
              placeholder="0"
              inputMode="numeric"
              className="almanac-numerals mt-1"
            />
            <p className="text-muted-foreground mt-1.5 text-[10px]">
              ⏎ {tCommon("save")} · Esc {tCommon("cancel")}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button size="sm" onClick={submit}>
              {tCommon("save")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
