"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { format, parse } from "date-fns";
import { da, enUS } from "date-fns/locale";
import {
  ArrowLeftRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { Skeleton } from "~/app/_components/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/_components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/app/_components/table";
import { EmptyState } from "~/app/_components/empty-state";
import { cn } from "~/app/_lib/utils";
import { TransactionFormDialog } from "~/app/(protected)/transactions/_components/transaction-form-dialog";

type Transaction = RouterOutputs["transaction"]["list"]["items"][number];

const ALL = "__all__";

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} kr.`;
}

export function AccountTransactions({ accountId }: { accountId: string }) {
  const t = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const tDetail = useTranslations("accounts.detail");
  const locale = useLocale();
  const utils = api.useUtils();
  const dateLocale = locale === "da" ? da : enUS;

  const { data: accounts = [] } = api.financialAccount.list.useQuery();
  const { data: categories = [] } = api.category.list.useQuery();

  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isLoading } = api.transaction.list.useQuery({
    accountId,
    type:
      typeFilter === ALL
        ? undefined
        : (typeFilter as "expense" | "income" | "transfer"),
    search: debouncedSearch || undefined,
  });
  const transactions = data?.items;

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const [editing, setEditing] = useState<Transaction | null>(null);

  const deleteTx = api.transaction.delete.useMutation({
    onSuccess: () => {
      void utils.transaction.list.invalidate();
      void utils.financialAccount.summary.invalidate();
      void utils.financialAccount.stats.invalidate();
      void utils.financialAccount.get.invalidate();
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">
          {tDetail("transactionsTitle")}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-auto min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allTypes")}</SelectItem>
              <SelectItem value="expense">{t("expense")}</SelectItem>
              <SelectItem value="income">{t("income")}</SelectItem>
              <SelectItem value="transfer">{t("transfer")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("date")}</TableHead>
                  <TableHead>{t("descriptionLabel")}</TableHead>
                  <TableHead>{tCommon("category")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : transactions?.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ArrowLeftRight}
              message={tDetail("noTransactions")}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tCommon("date")}</TableHead>
                <TableHead>{t("descriptionLabel")}</TableHead>
                <TableHead>{tCommon("category")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="w-[48px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions?.map((tx) => {
                const category = tx.categoryId
                  ? categoryMap.get(tx.categoryId)
                  : null;
                const dateObj = parse(tx.date, "yyyy-MM-dd", new Date());
                // A transfer showing up here is either outgoing (accountId === this)
                // or incoming (transferAccountId === this). Flip the sign accordingly.
                const isIncomingTransfer =
                  tx.type === "transfer" && tx.transferAccountId === accountId;
                const transferAccount = tx.transferAccountId
                  ? accountMap.get(
                      isIncomingTransfer ? tx.accountId : tx.transferAccountId,
                    )
                  : null;
                const sign =
                  tx.type === "expense"
                    ? -1
                    : tx.type === "income"
                      ? 1
                      : isIncomingTransfer
                        ? 1
                        : -1;
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(dateObj, "d. MMM yyyy", { locale: dateLocale })}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">
                        {tx.description}
                      </p>
                      {tx.note && (
                        <p className="text-xs text-muted-foreground">
                          {tx.note}
                        </p>
                      )}
                      {tx.type === "transfer" && transferAccount && (
                        <p className="text-xs text-muted-foreground">
                          {isIncomingTransfer ? "← " : "→ "}
                          {transferAccount.name}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {category ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                          {category.icon && <span>{category.icon}</span>}
                          {category.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap text-right font-medium",
                        tx.type === "expense" && "text-expense",
                        tx.type === "income" && "text-income",
                        tx.type === "transfer" && "text-savings",
                      )}
                    >
                      {sign === -1 && "-"}
                      {sign === 1 && "+"}
                      {formatAmount(tx.amount)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(tx)}>
                            <Pencil />
                            {tCommon("edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteTx.mutate({ id: tx.id })}
                          >
                            <Trash2 />
                            {tCommon("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <TransactionFormDialog
        key={editing?.id}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        transaction={editing ?? undefined}
        accounts={accounts}
      />
    </Card>
  );
}
