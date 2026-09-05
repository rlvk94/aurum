"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ClipboardPen, Gauge } from "lucide-react";

import { api } from "~/trpc/react";
import { Badge } from "~/app/_components/badge";
import { Button } from "~/app/_components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import { Skeleton } from "~/app/_components/skeleton";
import { cn } from "~/app/_lib/utils";
import { parseMonthsShort } from "~/app/(protected)/budgets/annual/_lib/budget-format";
import {
  formatChangePct,
  formatQuantity,
  formatReadingDate,
  percentChange,
} from "~/app/(protected)/consumption/_lib/format";
import {
  MeterIcon,
  meterTint,
} from "~/app/(protected)/consumption/_lib/meter-icons";
import { ReadMetersDialog } from "~/app/(protected)/consumption/_components/read-meters-dialog";

export function ConsumptionCard() {
  const t = useTranslations("dashboard");
  const tBudgets = useTranslations("budgets");
  const locale = useLocale();
  const months = parseMonthsShort(tBudgets("monthsShort"));
  const { data, isLoading } = api.consumption.summary.useQuery();
  const [readOpen, setReadOpen] = useState(false);

  const meters = (data?.meters ?? []).slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle className="text-xl sm:text-lg">{t("consumption")}</CardTitle>
        <Link
          href="/consumption"
          className="text-muted-foreground hover:text-foreground shrink-0 text-base sm:text-sm"
        >
          →
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : meters.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <Gauge className="text-muted-foreground h-6 w-6" />
            <p className="text-muted-foreground text-base sm:text-sm">
              {t("consumptionEmpty")}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/consumption">{t("consumptionCreateMeter")}</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {meters.map((m) => {
              const lcm = m.lastCompleteMonth;
              const pct = lcm
                ? percentChange(lcm.consumption, lcm.previousYearConsumption)
                : null;
              return (
                <Link
                  key={m.id}
                  href={`/consumption/${m.id}`}
                  className="border-border/70 hover:bg-accent/50 flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="bg-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                      <MeterIcon
                        kind={m.kind}
                        className={cn("h-4 w-4", meterTint(m.kind))}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="text-muted-foreground flex items-center gap-2 text-xs">
                        <span className="truncate">
                          {m.latestReadingDate
                            ? t("consumptionReadOn", {
                                date: formatReadingDate(
                                  m.latestReadingDate,
                                  locale,
                                ),
                              })
                            : t("consumptionNoReadings")}
                        </span>
                        {m.isOverdue && (
                          <Badge
                            variant="outline"
                            className="border-warning/40 text-warning h-5 px-1.5 text-[10px] whitespace-nowrap"
                          >
                            {t("consumptionOverdue")}
                          </Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {lcm ? (
                      <>
                        <p className="text-sm font-medium tabular-nums">
                          {formatQuantity(lcm.consumption, m.decimals, m.unit)}
                        </p>
                        <p className="text-muted-foreground text-xs tabular-nums">
                          {months[lcm.month - 1]}
                          {pct !== null && (
                            <span
                              className={cn(
                                "ml-1.5",
                                pct < 0 && "text-income",
                                pct > 0 && "text-expense",
                              )}
                            >
                              {formatChangePct(pct)}
                            </span>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm">—</p>
                    )}
                  </div>
                </Link>
              );
            })}
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              onClick={() => setReadOpen(true)}
            >
              <ClipboardPen />
              {t("consumptionReadMeters")}
            </Button>
            {data?.reminder.enabled && data.reminder.nextDueDate && (
              <p className="text-muted-foreground text-xs">
                {t("consumptionNextReminder", {
                  date: formatReadingDate(data.reminder.nextDueDate, locale),
                })}
              </p>
            )}
          </div>
        )}
      </CardContent>
      <ReadMetersDialog open={readOpen} onOpenChange={setReadOpen} />
    </Card>
  );
}
