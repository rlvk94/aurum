"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { format, parse } from "date-fns";
import { da, enUS } from "date-fns/locale";
import {
  ArrowLeftRight,
  Eye,
  EyeOff,
  Link2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/app/_components/tooltip";

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
        : (typeFilter as "expense" | "income"),
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

  const queryClient = useQueryClient();
  type ListData = { items: Transaction[]; nextCursor: unknown };
  type InfiniteData = { pages: ListData[]; pageParams: unknown[] };
  const transactionListKey: QueryKey = [["transaction", "list"]];

  const toggleExclusion = api.transaction.update.useMutation({
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: transactionListKey });
      const snapshot = queryClient.getQueriesData({
        queryKey: transactionListKey,
      });
      queryClient.setQueriesData(
        { queryKey: transactionListKey },
        (old: ListData | InfiniteData | undefined) => {
          if (!old) return old;
          const patchItem = (item: Transaction): Transaction =>
            item.id === variables.id
              ? {
                  ...item,
                  excludedFromCalculations:
                    variables.excludedFromCalculations ?? false,
                }
              : item;
          if ("pages" in old) {
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map(patchItem),
              })),
            };
          }
          return { ...old, items: old.items.map(patchItem) };
        },
      );
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshot) return;
      for (const [key, data] of ctx.snapshot) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () => {
      void utils.transaction.list.invalidate();
      void utils.financialAccount.stats.invalidate();
    },
  });

  return (
    <TooltipProvider delayDuration={200}>
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
            <SelectTrigger className="w-full sm:w-auto sm:min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allTypes")}</SelectItem>
              <SelectItem value="expense">{t("expense")}</SelectItem>
              <SelectItem value="income">{t("income")}</SelectItem>
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
          <>
            <div className="hidden md:block">
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
                    const sign = tx.type === "expense" ? -1 : 1;
                    return (
                      <TableRow
                        key={tx.id}
                        className={cn(
                          tx.excludedFromCalculations && "opacity-60",
                        )}
                      >
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {format(dateObj, "d. MMM yyyy", {
                            locale: dateLocale,
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {tx.transferGroupId && (
                              <Link2
                                className="text-muted-foreground h-3.5 w-3.5 shrink-0"
                                aria-label={t("linkedTransaction")}
                              />
                            )}
                            <div>
                              <p className="font-medium text-foreground">
                                {tx.description}
                              </p>
                              {tx.note && (
                                <p className="text-xs text-muted-foreground">
                                  {tx.note}
                                </p>
                              )}
                            </div>
                            {tx.excludedFromCalculations && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="border-border text-muted-foreground inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                                    <EyeOff className="h-3 w-3" aria-hidden />
                                    {t("excludedBadge")}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  {t("excludedTooltip")}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
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
                          )}
                        >
                          {sign === -1 ? "-" : "+"}
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
            </div>

            <ul className="divide-y divide-border md:hidden">
              {transactions?.map((tx) => {
                const category = tx.categoryId
                  ? categoryMap.get(tx.categoryId)
                  : null;
                const dateObj = parse(tx.date, "yyyy-MM-dd", new Date());
                const sign = tx.type === "expense" ? -1 : 1;
                return (
                  <li
                    key={tx.id}
                    className={cn(
                      "px-4 py-3",
                      tx.excludedFromCalculations && "opacity-60",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {tx.transferGroupId && (
                            <Link2
                              className="h-3 w-3 shrink-0"
                              aria-label={t("linkedTransaction")}
                            />
                          )}
                          <span className="whitespace-nowrap">
                            {format(dateObj, "d. MMM yyyy", {
                              locale: dateLocale,
                            })}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                          {tx.description}
                        </p>
                        {tx.note && (
                          <p className="truncate text-xs text-muted-foreground">
                            {tx.note}
                          </p>
                        )}
                        {(category || tx.excludedFromCalculations) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {category && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                                {category.icon && <span>{category.icon}</span>}
                                {category.name}
                              </span>
                            )}
                            {tx.excludedFromCalculations && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                                    <EyeOff className="h-3 w-3" aria-hidden />
                                    {t("excludedBadge")}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  {t("excludedTooltip")}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            "whitespace-nowrap text-sm font-medium",
                            tx.type === "expense" && "text-expense",
                            tx.type === "income" && "text-income",
                          )}
                        >
                          {sign === -1 ? "-" : "+"}
                          {formatAmount(tx.amount)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="-mr-1 h-8 w-8"
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
                              onClick={() =>
                                toggleExclusion.mutate({
                                  id: tx.id,
                                  excludedFromCalculations:
                                    !tx.excludedFromCalculations,
                                })
                              }
                            >
                              {tx.excludedFromCalculations ? (
                                <Eye />
                              ) : (
                                <EyeOff />
                              )}
                              {tx.excludedFromCalculations
                                ? t("includeAction")
                                : t("excludeAction")}
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
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
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
    </TooltipProvider>
  );
}
