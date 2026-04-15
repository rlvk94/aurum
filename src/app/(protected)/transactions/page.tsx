"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { format, parse } from "date-fns";
import { da, enUS } from "date-fns/locale";
import {
  ArrowLeftRight,
  Plus,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { Skeleton } from "~/app/_components/skeleton";
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
import { TransactionFormDialog } from "./_components/transaction-form-dialog";
import { CsvImportDialog } from "./_components/csv-import-dialog";
import { cn } from "~/app/_lib/utils";

type Transaction = RouterOutputs["transaction"]["list"][number];

const ALL = "__all__";
const UNCATEGORIZED = "__uncategorized__";

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} kr.`;
}

export default function TransactionsPage() {
  const t = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const utils = api.useUtils();
  const dateLocale = locale === "da" ? da : enUS;

  const { data: accounts = [] } = api.financialAccount.list.useQuery();
  const { data: categories = [] } = api.category.list.useQuery();
  const [accountFilter, setAccountFilter] = useState<string>(ALL);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data: transactions, isLoading } = api.transaction.list.useQuery({
    accountId: accountFilter === ALL ? undefined : accountFilter,
    type:
      typeFilter === ALL
        ? undefined
        : (typeFilter as "expense" | "income" | "transfer"),
    categoryId:
      categoryFilter === ALL
        ? undefined
        : categoryFilter === UNCATEGORIZED
          ? null
          : categoryFilter,
    search: debouncedSearch || undefined,
  });

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const deleteTx = api.transaction.delete.useMutation({
    onSuccess: () => {
      void utils.transaction.list.invalidate();
      void utils.financialAccount.summary.invalidate();
    },
  });

  const hasAccounts = accounts.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              disabled={!hasAccounts}
            >
              <Upload />
              {t("importCsv")}
            </Button>
            <Button
              onClick={() => setCreateOpen(true)}
              disabled={!hasAccounts}
            >
              <Plus />
              {t("addTransaction")}
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-auto min-w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allAccounts")}</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-auto min-w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allCategories")}</SelectItem>
            <SelectItem value={UNCATEGORIZED}>
              {t("uncategorizedFilter")}
            </SelectItem>
            {categories
              .filter((c) => !c.archived)
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.icon && <span className="mr-1.5">{c.icon}</span>}
                  {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tCommon("date")}</TableHead>
                <TableHead>{t("descriptionLabel")}</TableHead>
                <TableHead>{tCommon("category")}</TableHead>
                <TableHead>{t("account")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="w-[48px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 25 }).map((_, i) => (
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
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto h-4 w-20" />
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : transactions?.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} message={t("emptyState")} />
      ) : (
        <div className="rounded-lg border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tCommon("date")}</TableHead>
                <TableHead>{t("descriptionLabel")}</TableHead>
                <TableHead>{tCommon("category")}</TableHead>
                <TableHead>{t("account")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="w-[48px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions?.map((tx) => {
                const account = accountMap.get(tx.accountId);
                const transferAccount = tx.transferAccountId
                  ? accountMap.get(tx.transferAccountId)
                  : null;
                const category = tx.categoryId
                  ? categoryMap.get(tx.categoryId)
                  : null;
                const dateObj = parse(tx.date, "yyyy-MM-dd", new Date());
                const sign =
                  tx.type === "expense"
                    ? -1
                    : tx.type === "income"
                      ? 1
                      : 0;
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
                    </TableCell>
                    <TableCell>
                      {category ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                          {category.icon && <span>{category.icon}</span>}
                          {category.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {account?.name ?? "—"}
                      {transferAccount && (
                        <span className="text-xs">
                          {" → "}
                          {transferAccount.name}
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
        </div>
      )}

      <TransactionFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accounts={accounts}
      />
      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        accounts={accounts}
      />
      <TransactionFormDialog
        key={editing?.id}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        transaction={editing ?? undefined}
        accounts={accounts}
      />
    </div>
  );
}
