"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { da, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "~/app/_lib/utils";
import { Button } from "~/app/_components/button";
import { Calendar } from "~/app/_components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/app/_components/popover";

export type DatePickerProps = {
  id?: string;
  value: string | null;
  onChange: (iso: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
  "aria-invalid"?: boolean;
  className?: string;
};

/**
 * Date picker following the shadcn Date Picker recipe:
 * Button trigger + Popover + Calendar with captionLayout="dropdown" so
 * the user can jump across years via the built-in month/year dropdowns.
 * Value is an ISO yyyy-MM-dd string.
 */
export function DatePicker({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  minYear = 1970,
  maxYear,
  className,
  ...rest
}: DatePickerProps) {
  const locale = useLocale();
  const dateLocale = locale === "da" ? da : enUS;
  const [open, setOpen] = React.useState(false);

  const selected = React.useMemo(() => {
    if (!value) return undefined;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : undefined;
  }, [value]);

  const start = React.useMemo(() => new Date(minYear, 0, 1), [minYear]);
  const end = React.useMemo(() => {
    const y = maxYear ?? new Date().getFullYear() + 30;
    return new Date(y, 11, 31);
  }, [maxYear]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          data-empty={!selected}
          onBlur={onBlur}
          className={cn(
            "data-[empty=true]:text-muted-foreground w-full justify-start text-left font-normal",
            className,
          )}
          aria-invalid={rest["aria-invalid"]}
        >
          <CalendarIcon />
          {selected ? (
            format(selected, "PPP", { locale: dateLocale })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          startMonth={start}
          endMonth={end}
          locale={dateLocale}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
