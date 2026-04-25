"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { format, parse } from "date-fns";
import { da, enUS } from "date-fns/locale";
import {
  ArrowLeftRight,
  FolderHeart,
  Link2,
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
import posthog from "posthog-js";
import { TransactionFormDialog } from "./_components/transaction-form-dialog";
import { TransactionCategoryDialog } from "./_components/transaction-category-dialog";
import { TransactionProjectQuickAssign } from "./_components/transaction-project-quick-assign";
import { CsvImportDialog } from "./_components/csv-import-dialog";
import type { ProjectPalette } from "../projects/_lib/format";
import {
  CategorySelect,
  UNCATEGORIZED_SENTINEL,
} from "~/app/_components/category-select";
import { cn } from "~/app/_lib/utils";

type Transaction = RouterOutputs["transaction"]["list"]["items"][number];

const ALL = "__all__";
const UNASSIGNED = "unassigned";

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
  const tProjects = useTranslations("projects");
  const locale = useLocale();
  const utils = api.useUtils();
  const dateLocale = locale === "da" ? da : enUS;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectQuery = searchParams.get("project");

  const { data: accounts = [] } = api.financialAccount.list.useQuery();
  const { data: categories = [] } = api.category.list.useQuery();
  const { data: projects = [] } = api.project.list.useQuery({
    includeArchived: true,
  });
  const [accountFilter, setAccountFilter] = useState<string>(ALL);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Project filter is sourced from the URL; updates push a new URL.
  const projectFilter = projectQuery ?? ALL;
  const setProjectFilterAndUrl = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === ALL) {
      params.delete("project");
    } else {
      params.set("project", next);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const {
    data: infiniteData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.transaction.list.useInfiniteQuery(
    {
      accountId: accountFilter === ALL ? undefined : accountFilter,
      type:
        typeFilter === ALL
          ? undefined
          : (typeFilter as "expense" | "income"),
      categoryIds: categoryFilter
        .filter((v) => v !== UNCATEGORIZED_SENTINEL)
        .filter((v) => v.length > 0),
      includeUncategorized: categoryFilter.includes(UNCATEGORIZED_SENTINEL),
      projectId:
        projectFilter === ALL
          ? undefined
          : projectFilter === UNASSIGNED
            ? null
            : projectFilter,
      search: debouncedSearch || undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    },
  );
  const transactions = useMemo(
    () => infiniteData?.pages.flatMap((p) => p.items) ?? [],
    [infiniteData],
  );

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [quickAssign, setQuickAssign] = useState<Transaction | null>(null);
  const [projectAssign, setProjectAssign] = useState<Transaction | null>(null);

  const deleteTx = api.transaction.delete.useMutation({
    onSuccess: (_, variables) => {
      posthog.capture("transaction_deleted", { transaction_id: variables.id });
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
            <Button onClick={() => setCreateOpen(true)} disabled={!hasAccounts}>
              <Plus />
              {t("addTransaction")}
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px]">
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
            <SelectTrigger className="w-full sm:w-auto sm:min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allTypes")}</SelectItem>
              <SelectItem value="expense">{t("expense")}</SelectItem>
              <SelectItem value="income">{t("income")}</SelectItem>
            </SelectContent>
          </Select>

          <div className="w-full sm:w-[220px]">
            <CategorySelect
              multiple
              value={categoryFilter}
              onChange={setCategoryFilter}
              categories={categories}
              mode="any"
              uncategorizedOption
              placeholder={t("allCategories")}
            />
          </div>

          <Select value={projectFilter} onValueChange={setProjectFilterAndUrl}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{tProjects("allProjects")}</SelectItem>
              <SelectItem value={UNASSIGNED}>
                {tProjects("unassigned")}
              </SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="mr-1">{p.emoji}</span>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <>
          <div className="hidden border-border bg-card shadow-card rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("date")}</TableHead>
                  <TableHead>{t("descriptionLabel")}</TableHead>
                  <TableHead>{tCommon("category")}</TableHead>
                  <TableHead>{tProjects("filterLabel")}</TableHead>
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
                      <Skeleton className="h-6 w-20 rounded-full" />
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
          <div className="space-y-2 md:hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card p-3 shadow-card"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-4 w-3/4" />
                <div className="mt-3 flex items-center justify-between">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : transactions.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} message={t("emptyState")} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden border-border bg-card shadow-card rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("date")}</TableHead>
                  <TableHead>{t("descriptionLabel")}</TableHead>
                  <TableHead>{tCommon("category")}</TableHead>
                  <TableHead>{tProjects("filterLabel")}</TableHead>
                  <TableHead>{t("account")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                  <TableHead className="w-[48px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const account = accountMap.get(tx.accountId);
                  const category = tx.categoryId
                    ? categoryMap.get(tx.categoryId)
                    : null;
                  const txProject = tx.projectId
                    ? projectMap.get(tx.projectId)
                    : null;
                  const dateObj = parse(tx.date, "yyyy-MM-dd", new Date());
                  const sign = tx.type === "expense" ? -1 : 1;
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(dateObj, "d. MMM yyyy", { locale: dateLocale })}
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
                            <p className="text-foreground font-medium">
                              {tx.description}
                            </p>
                            {tx.note && (
                              <p className="text-muted-foreground text-xs">
                                {tx.note}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setQuickAssign(tx)}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition hover:ring-2 hover:ring-primary/40"
                        >
                          {category ? (
                            <span className="bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5">
                              {category.icon && <span>{category.icon}</span>}
                              {category.name}
                            </span>
                          ) : (
                            <span className="border-dashed border-muted-foreground/40 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                              + {t("uncategorizedFilter")}
                            </span>
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setProjectAssign(tx)}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition hover:ring-2 hover:ring-primary/40"
                        >
                          {txProject ? (
                            <span
                              data-project-palette={
                                txProject.coverPalette as ProjectPalette
                              }
                              className="project-cover-shimmer inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[var(--cover-glyph)]"
                            >
                              <span>{txProject.emoji}</span>
                              <span className="max-w-[8rem] truncate">
                                {txProject.name}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-muted-foreground">
                              +{" "}
                              <FolderHeart
                                className="h-3 w-3"
                                aria-hidden
                              />
                            </span>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {account?.name ?? "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium whitespace-nowrap",
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
                              onClick={() => setProjectAssign(tx)}
                            >
                              <FolderHeart />
                              {tProjects("assignToProject")}
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

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {transactions.map((tx) => {
              const account = accountMap.get(tx.accountId);
              const category = tx.categoryId
                ? categoryMap.get(tx.categoryId)
                : null;
              const txProject = tx.projectId
                ? projectMap.get(tx.projectId)
                : null;
              const dateObj = parse(tx.date, "yyyy-MM-dd", new Date());
              const sign = tx.type === "expense" ? -1 : 1;
              return (
                <li
                  key={tx.id}
                  className="rounded-lg border border-border bg-card p-3 shadow-card"
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
                        {account && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="truncate">{account.name}</span>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditing(tx)}
                        className="mt-0.5 block w-full text-left"
                      >
                        <p className="truncate text-sm font-medium text-foreground">
                          {tx.description}
                        </p>
                        {tx.note && (
                          <p className="truncate text-xs text-muted-foreground">
                            {tx.note}
                          </p>
                        )}
                      </button>
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
                            className="-mr-1 h-8 w-8 shrink-0"
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
                            onClick={() => setProjectAssign(tx)}
                          >
                            <FolderHeart />
                            {tProjects("assignToProject")}
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
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQuickAssign(tx)}
                      className="inline-flex items-center gap-1 rounded-full text-xs transition hover:ring-2 hover:ring-primary/40"
                    >
                      {category ? (
                        <span className="bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5">
                          {category.icon && <span>{category.icon}</span>}
                          {category.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-muted-foreground">
                          + {t("uncategorizedFilter")}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectAssign(tx)}
                      className="inline-flex items-center gap-1 rounded-full text-xs transition hover:ring-2 hover:ring-primary/40"
                    >
                      {txProject ? (
                        <span
                          data-project-palette={
                            txProject.coverPalette as ProjectPalette
                          }
                          className="project-cover-shimmer inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[var(--cover-glyph)]"
                        >
                          <span>{txProject.emoji}</span>
                          <span className="max-w-[8rem] truncate">
                            {txProject.name}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-muted-foreground">
                          + <FolderHeart className="h-3 w-3" aria-hidden />
                        </span>
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {!isLoading && transactions.length > 0 && hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? tCommon("loading") : t("loadMore")}
          </Button>
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
      <TransactionCategoryDialog
        transactionId={quickAssign?.id ?? null}
        currentCategoryId={quickAssign?.categoryId ?? null}
        open={!!quickAssign}
        onOpenChange={(open) => !open && setQuickAssign(null)}
      />
      <TransactionProjectQuickAssign
        transactionId={projectAssign?.id ?? null}
        currentProjectId={projectAssign?.projectId ?? null}
        open={!!projectAssign}
        onOpenChange={(open) => !open && setProjectAssign(null)}
      />
    </div>
  );
}
