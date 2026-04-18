"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { format, parse } from "date-fns";
import { da, enUS } from "date-fns/locale";
import { ChevronDown, ChevronUp } from "lucide-react";

import { api } from "~/trpc/react";
import { PERIOD_MONTHS } from "~/server/lib/amortization";
import { PageHeader } from "~/app/_components/page-header";
import { usePageMetadata } from "~/app/_components/page-metadata";
import { Button } from "~/app/_components/button";
import { Badge } from "~/app/_components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/app/_components/table";

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} kr.`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}

export function DebtDetailClient({ id }: { id: string }) {
  const t = useTranslations("debts");
  const locale = useLocale();
  const dateLocale = locale === "da" ? da : enUS;
  const [showSchedule, setShowSchedule] = useState(false);

  const { data: debt } = api.debt.get.useQuery({ id });

  usePageMetadata(debt ? { title: debt.name, parentPath: "/debts" } : null);

  if (!debt) return null;

  const { summary, schedule } = debt;
  const progressPct = Math.round(summary.progress * 100);
  const paidOff = summary.outstandingBalance === 0;
  const startDateStr = format(
    parse(debt.startDate, "yyyy-MM-dd", new Date()),
    "PPP",
    { locale: dateLocale },
  );
  const payoffDateStr = format(
    parse(summary.payoffDate, "yyyy-MM-dd", new Date()),
    "PPP",
    { locale: dateLocale },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={debt.name}
        description={debt.lender}
        actions={
          paidOff ? <Badge variant="secondary">{t("paidOff")}</Badge> : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("currentBalance")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl text-debt">
              {formatAmount(summary.outstandingBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t(`paymentPerFrequency.${debt.paymentFrequency}`)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl">
              {formatAmount(summary.periodicPayment)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("principalPaid")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl text-income">
              {formatAmount(summary.principalPaid)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("interestPaid")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl">
              {formatAmount(summary.interestPaidToDate)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("progress")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{progressPct}%</span>
              <span>
                {t("monthsRemaining", {
                  count:
                    Math.max(
                      0,
                      summary.numberOfPayments - summary.paymentsMade,
                    ) * PERIOD_MONTHS[debt.paymentFrequency],
                })}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 sm:grid-cols-4">
            <Stat
              label={t("principal")}
              value={formatAmount(debt.principal)}
            />
            <Stat
              label={t("interestRate")}
              value={`${(debt.interestRateBps / 100).toFixed(2)}%`}
            />
            <Stat label={t("startDate")} value={startDateStr} />
            <Stat label={t("payoffDate")} value={payoffDateStr} />
            <Stat
              label={t("paymentFrequency")}
              value={t(`frequency.${debt.paymentFrequency}`)}
            />
            <Stat
              label={t("paymentsMade")}
              value={`${summary.paymentsMade} / ${summary.numberOfPayments}`}
            />
            <Stat
              label={t("totalInterest")}
              value={formatAmount(summary.totalInterest)}
            />
            <Stat
              label={t("totalCost")}
              value={formatAmount(summary.totalPaid)}
            />
            {debt.assetName && (
              <Stat label={t("linkedAsset")} value={debt.assetName} />
            )}
            {debt.note && <Stat label={t("note")} value={debt.note} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("schedule")}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSchedule((v) => !v)}
          >
            {showSchedule ? <ChevronUp /> : <ChevronDown />}
            {showSchedule ? t("hideSchedule") : t("showSchedule")}
          </Button>
        </CardHeader>
        {showSchedule && (
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      {t("scheduleTable.payment")}
                    </TableHead>
                    <TableHead>{t("scheduleTable.date")}</TableHead>
                    <TableHead className="text-right">
                      {t("scheduleTable.paymentAmount")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("scheduleTable.principalPortion")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("scheduleTable.interestPortion")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("scheduleTable.balanceAfter")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((row) => {
                    const isPast = row.index <= summary.paymentsMade;
                    return (
                      <TableRow
                        key={row.index}
                        className={isPast ? "opacity-60" : ""}
                      >
                        <TableCell className="font-mono text-xs">
                          {row.index}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(
                            parse(row.paymentDate, "yyyy-MM-dd", new Date()),
                            "d MMM yyyy",
                            { locale: dateLocale },
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatAmount(row.payment)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-income">
                          {formatAmount(row.principal)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {formatAmount(row.interest)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatAmount(row.balanceAfter)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
