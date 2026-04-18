"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";

import { api } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { usePageMetadata } from "~/app/_components/page-metadata";
import { Button } from "~/app/_components/button";
import { Badge } from "~/app/_components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import { cn } from "~/app/_lib/utils";
import {
  AccountFormDialog,
  accountTypeIcons,
  accountTypeKeys,
} from "~/app/(protected)/accounts/_components/account-form-dialog";
import { MonthlyChart } from "./monthly-chart";
import { CategoryBreakdownCard } from "./category-breakdown-card";
import { AccountTransactions } from "./account-transactions";

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return value < 0 ? `-${formatted} kr.` : `${formatted} kr.`;
}

export function AccountDetailClient({ id }: { id: string }) {
  const t = useTranslations("accounts");
  const tCommon = useTranslations("common");
  const tDetail = useTranslations("accounts.detail");

  const [editOpen, setEditOpen] = useState(false);

  const { data: account } = api.financialAccount.get.useQuery({ id });
  const { data: stats } = api.financialAccount.stats.useQuery({
    id,
    months: 12,
  });

  usePageMetadata(
    account ? { title: account.name, parentPath: "/accounts" } : null,
  );

  if (!account) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">{tDetail("notFound")}</p>
      </div>
    );
  }

  const Icon = accountTypeIcons[account.type];
  const typeLabel = t(`types.${accountTypeKeys[account.type]}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title={account.name}
        description={typeLabel}
        actions={
          <>
            {account.archived && (
              <Badge variant="secondary">{t("archived")}</Badge>
            )}
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil />
              {tCommon("edit")}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tDetail("currentBalance")}
            </CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "font-display text-2xl",
                account.balance < 0 && "text-expense",
              )}
            >
              {formatAmount(account.balance)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tDetail("totalIncome")}
            </CardTitle>
            <CardDescription className="text-xs">
              {tDetail("last12Months")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl text-income">
              {stats ? formatAmount(stats.totals.incomeCents) : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tDetail("totalExpense")}
            </CardTitle>
            <CardDescription className="text-xs">
              {tDetail("last12Months")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl text-expense">
              {stats ? formatAmount(stats.totals.expenseCents) : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {tDetail("netChange")}
            </CardTitle>
            <CardDescription className="text-xs">
              {tDetail("last12Months")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "font-display text-2xl",
                stats && stats.totals.netChangeCents < 0 && "text-expense",
                stats && stats.totals.netChangeCents > 0 && "text-income",
              )}
            >
              {stats ? formatAmount(stats.totals.netChangeCents) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {tDetail("monthlyActivity")}
          </CardTitle>
          <CardDescription>{tDetail("monthlyDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.monthly.some((m) => m.incomeCents || m.expenseCents) ? (
            <MonthlyChart monthly={stats.monthly} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {tDetail("noMonthlyData")}
            </p>
          )}
        </CardContent>
      </Card>

      <CategoryBreakdownCard accountId={id} />

      <AccountTransactions accountId={id} />

      <AccountFormDialog
        key={editOpen ? "open" : "closed"}
        open={editOpen}
        onOpenChange={setEditOpen}
        account={account}
      />
    </div>
  );
}
