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

type Props = {
  planned: number;
  monthLabel: string;
  isCurrent?: boolean;
  onSave: (amountCents: number) => void;
};

// Cell used on individual line rows. Shows just the planned amount — no
// actual, no variance — since actuals are aggregated at category level.
export function LineCell({ planned, monthLabel, isCurrent, onSave }: Props) {
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

  const submit = () => {
    const parsed = parseMoneyInput(value);
    if (parsed === null || parsed < 0) return;
    onSave(parsed);
    setOpen(false);
  };

  const Display = (
    <span
      className={`almanac-numerals text-[12px] tabular-nums ${
        planned > 0 ? "text-foreground" : "text-muted-foreground/50"
      }`}
    >
      {planned > 0 ? formatMoney(planned) : "—"}
    </span>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${monthLabel}: ${t("cellEdit")}`}
          className={`flex h-full w-full items-center justify-end rounded-[6px] px-2.5 py-2 text-right transition-colors hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
            isCurrent ? "bg-primary/[0.03]" : ""
          }`}
        >
          {Display}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-4" align="center">
        <div className="space-y-4">
          <div>
            <p className="almanac-smallcaps text-[10px] text-muted-foreground">
              {monthLabel}
            </p>
            <p className="mt-1 font-display text-2xl text-foreground almanac-numerals">
              {planned > 0 ? formatMoney(planned) : "—"}
            </p>
          </div>
          <div>
            <label
              className="almanac-smallcaps text-[9px] text-muted-foreground"
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
              className="mt-1 almanac-numerals"
            />
            <p className="mt-1.5 text-[10px] text-muted-foreground">
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
