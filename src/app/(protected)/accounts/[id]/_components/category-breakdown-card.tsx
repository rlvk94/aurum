"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { da, enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import { Tabs, TabsList, TabsTrigger } from "~/app/_components/tabs";
import { CategorySplit, CategorySplitSkeleton } from "./category-split";

type Mode = "12m" | "month" | "week";

function toIso(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function rangeFor(mode: Mode, cursor: Date, weekStartsOn: 0 | 1 = 1) {
  if (mode === "12m") {
    const end = new Date();
    const start = addMonths(startOfMonth(end), -11);
    return { from: toIso(start), to: toIso(endOfMonth(end)) };
  }
  if (mode === "month") {
    return {
      from: toIso(startOfMonth(cursor)),
      to: toIso(endOfMonth(cursor)),
    };
  }
  return {
    from: toIso(startOfWeek(cursor, { weekStartsOn })),
    to: toIso(endOfWeek(cursor, { weekStartsOn })),
  };
}

export function CategoryBreakdownCard({ accountId }: { accountId: string }) {
  const t = useTranslations("accounts.detail");
  const locale = useLocale();
  const dateLocale = locale === "da" ? da : enUS;
  const weekStartsOn = 1 as const;

  const [mode, setMode] = useState<Mode>("12m");
  const [cursor, setCursor] = useState<Date>(() => new Date());

  const { from, to } = useMemo(
    () => rangeFor(mode, cursor, weekStartsOn),
    [mode, cursor],
  );

  const { data, isPending } = api.financialAccount.categorySplit.useQuery({
    id: accountId,
    from,
    to,
  });

  const label = useMemo(() => {
    if (mode === "12m") return t("last12Months");
    if (mode === "month") {
      return format(cursor, "LLLL yyyy", { locale: dateLocale });
    }
    const weekNum = getISOWeek(cursor);
    const weekYear = getISOWeekYear(cursor);
    const ws = startOfWeek(cursor, { weekStartsOn });
    const we = endOfWeek(cursor, { weekStartsOn });
    return `${t("weekShort", { n: weekNum, year: weekYear })} · ${format(ws, "d. MMM", { locale: dateLocale })} – ${format(we, "d. MMM", { locale: dateLocale })}`;
  }, [mode, cursor, dateLocale, t]);

  const step = (delta: -1 | 1) => {
    if (mode === "month") setCursor((c) => addMonths(c, delta));
    else if (mode === "week") setCursor((c) => addWeeks(c, delta));
  };

  const entries = data?.entries ?? [];
  const totalCents = data?.totalCents ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">{t("categoryBreakdown")}</CardTitle>
          <CardDescription>{label}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as Mode);
              setCursor(new Date());
            }}
          >
            <TabsList>
              <TabsTrigger value="12m">{t("period12Months")}</TabsTrigger>
              <TabsTrigger value="month">{t("periodMonth")}</TabsTrigger>
              <TabsTrigger value="week">{t("periodWeek")}</TabsTrigger>
            </TabsList>
          </Tabs>
          {mode !== "12m" && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => step(-1)}
                aria-label={t("previous")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => step(1)}
                aria-label={t("next")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <CategorySplitSkeleton />
        ) : totalCents > 0 ? (
          <CategorySplit entries={entries} totalCents={totalCents} />
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {t("noExpenses")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
