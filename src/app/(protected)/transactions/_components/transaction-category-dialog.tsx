"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, MinusCircle, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import { cn } from "~/app/_lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import { useIsMobile } from "~/app/_hooks/use-mobile";
import { Button } from "~/app/_components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "~/app/_components/drawer";

type Category = RouterOutputs["category"]["list"][number];

type Props = {
  transactionId: string | null;
  currentCategoryId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When supplied, the dialog defers the mutation to the caller and
  // closes after onPick returns. Used for the bulk-action flow where
  // the caller knows the selection.
  onPick?: (categoryId: string | null) => void;
};

export function TransactionCategoryDialog({
  transactionId,
  currentCategoryId,
  open,
  onOpenChange,
  onPick,
}: Props) {
  const t = useTranslations("transactions");
  const isMobile = useIsMobile();
  const shouldRender = open && (transactionId !== null || onPick !== undefined);
  const flowKey = transactionId ?? "bulk";

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg gap-0 p-0 sm:p-0 [&>button.absolute]:top-5">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("assignCategoryTitle")}</DialogTitle>
            <DialogDescription>
              {t("assignCategoryDescription")}
            </DialogDescription>
          </DialogHeader>
          {shouldRender && (
            <CategoryGridFlow
              key={flowKey}
              transactionId={transactionId}
              currentCategoryId={currentCategoryId}
              onClose={() => onOpenChange(false)}
              onPick={onPick}
            />
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{t("assignCategoryTitle")}</DrawerTitle>
          <DrawerDescription>
            {t("assignCategoryDescription")}
          </DrawerDescription>
        </DrawerHeader>
        {shouldRender && (
          <CategoryGridFlow
            key={flowKey}
            transactionId={transactionId}
            currentCategoryId={currentCategoryId}
            onClose={() => onOpenChange(false)}
            onPick={onPick}
            mobile
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function CategoryGridFlow({
  transactionId,
  currentCategoryId,
  onClose,
  onPick,
  mobile = false,
}: {
  transactionId: string | null;
  currentCategoryId: string | null;
  onClose: () => void;
  onPick?: (categoryId: string | null) => void;
  mobile?: boolean;
}) {
  const t = useTranslations("transactions");
  const tCategories = useTranslations("categories");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  const { data: categories = [] } = api.category.list.useQuery();

  type TxItem = RouterOutputs["transaction"]["list"]["items"][number];
  type ListData = { items: TxItem[]; nextCursor: unknown };
  type ListPage = ListData;
  type InfiniteData = { pages: ListPage[]; pageParams: unknown[] };

  const transactionListKey: QueryKey = [["transaction", "list"]];

  const updateTx = api.transaction.update.useMutation({
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: transactionListKey });
      const snapshot = queryClient.getQueriesData({
        queryKey: transactionListKey,
      });
      queryClient.setQueriesData(
        { queryKey: transactionListKey },
        (old: ListData | InfiniteData | undefined) => {
          if (!old) return old;
          const patchItem = (item: TxItem): TxItem =>
            item.id === variables.id
              ? { ...item, categoryId: variables.categoryId ?? null }
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
    onSuccess: (_, variables) => {
      posthog.capture("transaction_categorized", {
        transaction_id: variables.id,
        category_id: variables.categoryId ?? null,
      });
    },
    onSettled: () => {
      void utils.transaction.list.invalidate();
      void utils.challenge.list.invalidate();
      void utils.challenge.get.invalidate();
    },
  });

  // After a single-transaction pick, offer to apply the same category to other
  // uncategorized transactions from the same merchant.
  const [similarPrompt, setSimilarPrompt] = useState<{
    categoryId: string;
    count: number;
  } | null>(null);
  const applySimilar = api.transaction.applyToSimilar.useMutation();

  async function applyToSimilarConfirmed() {
    if (!transactionId || !similarPrompt) return;
    await applySimilar.mutateAsync({
      sourceTransactionId: transactionId,
      categoryId: similarPrompt.categoryId,
    });
    posthog.capture("transactions_applied_to_similar", {
      category_id: similarPrompt.categoryId,
      count: similarPrompt.count,
    });
    void utils.transaction.list.invalidate();
    void utils.challenge.list.invalidate();
    void utils.challenge.get.invalidate();
    onClose();
  }

  const groups = useMemo(() => {
    const visible = categories.filter((c) => !c.archived);
    const topLevel = visible.filter((c) => !c.parentId);
    const childrenByParent = new Map<string, Category[]>();
    for (const c of visible) {
      if (c.parentId) {
        const list = childrenByParent.get(c.parentId) ?? [];
        list.push(c);
        childrenByParent.set(c.parentId, list);
      }
    }
    return topLevel.map((parent) => ({
      parent,
      children: childrenByParent.get(parent.id) ?? [],
    }));
  }, [categories]);

  const initialParent = useMemo(() => {
    if (!currentCategoryId) return null;
    const cat = categories.find((c) => c.id === currentCategoryId);
    return cat?.parentId ?? null;
  }, [categories, currentCategoryId]);

  const [step, setStep] = useState<"parent" | "child">(
    initialParent ? "child" : "parent",
  );
  const [selectedParentId, setSelectedParentId] = useState<string | null>(
    initialParent,
  );
  const [search, setSearch] = useState("");
  const searchQuery = search.trim().toLowerCase();
  const isSearching = searchQuery.length > 0;

  const selectedParent = groups.find(
    (g) => g.parent.id === selectedParentId,
  )?.parent;
  const selectedChildren =
    groups.find((g) => g.parent.id === selectedParentId)?.children ?? [];

  const searchMatches = useMemo(() => {
    if (!searchQuery) return [];
    const out: Array<{ parent: Category; child: Category }> = [];
    for (const { parent, children } of groups) {
      for (const child of children) {
        const hay = [child.name, parent.name].join(" ").toLowerCase();
        if (hay.includes(searchQuery)) out.push({ parent, child });
      }
    }
    return out;
  }, [groups, searchQuery]);

  function pickParent(id: string) {
    setSelectedParentId(id);
    setStep("child");
  }

  function pickLeaf(id: string | null) {
    if (onPick) {
      onPick(id);
      onClose();
      return;
    }
    if (!transactionId) return;
    updateTx.mutate({ id: transactionId, categoryId: id });
    // Removing a category, or re-picking the same one: nothing to fan out.
    if (id === null || id === currentCategoryId) {
      onClose();
      return;
    }
    // Check for other uncategorized transactions from the same merchant.
    const txId = transactionId;
    applySimilar
      .mutateAsync({ sourceTransactionId: txId, categoryId: id, dryRun: true })
      .then((res) => {
        if (res.matched > 0) setSimilarPrompt({ categoryId: id, count: res.matched });
        else onClose();
      })
      .catch(() => onClose());
  }

  if (similarPrompt) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="space-y-1">
          <h2 className="font-display text-lg">{t("applyToSimilarTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("applyToSimilarBody", { count: similarPrompt.count })}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={applySimilar.isPending}
          >
            {t("applyToSimilarCancel")}
          </Button>
          <Button
            onClick={() => void applyToSimilarConfirmed()}
            disabled={applySimilar.isPending}
          >
            {t("applyToSimilarConfirm", { count: similarPrompt.count })}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[min(560px,80dvh)] flex-col">
      <div className="flex min-h-14 items-center gap-2 border-b px-4 py-2">
        {step === "child" && !isSearching ? (
          <button
            type="button"
            onClick={() => setStep("parent")}
            className="-ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
            aria-label={tCommon("back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <span className="w-8" aria-hidden />
        )}
        <div className="flex-1 text-center font-display text-base">
          {isSearching || step === "parent" ? (
            t("assignCategoryTitle")
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {selectedParent?.icon && <span>{selectedParent.icon}</span>}
              <span>{selectedParent?.name}</span>
            </span>
          )}
        </div>
        <span className="w-8" aria-hidden />
      </div>

      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tCategories("searchCategoriesPlaceholder")}
          className="h-full flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          autoFocus={!mobile}
        />
        <button
          type="button"
          onClick={() => setSearch("")}
          aria-label={tCommon("clear")}
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground",
            !search && "invisible",
          )}
          tabIndex={search ? 0 : -1}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isSearching ? (
        <div className="flex-1 overflow-y-auto p-4">
          {searchMatches.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {tCategories("noCategoriesMatch")}
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {searchMatches.map(({ parent, child }) => (
                <li key={child.id}>
                  <button
                    type="button"
                    onClick={() => pickLeaf(child.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-accent/50 active:scale-[0.99]",
                      child.id === currentCategoryId &&
                        "border-primary bg-primary/5",
                    )}
                  >
                    <span className="text-xl leading-none">
                      {child.icon ?? parent.icon ?? "📁"}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={cn(
                          "truncate font-medium",
                          mobile ? "text-base" : "text-sm",
                        )}
                      >
                        {child.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {parent.name}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <div
            className="flex h-full w-[200%] transition-transform duration-300 ease-out"
            style={{
              transform:
                step === "parent" ? "translateX(0)" : "translateX(-50%)",
            }}
          >
            <section
              className="h-full w-1/2 shrink-0 overflow-y-auto"
              aria-hidden={step !== "parent"}
            >
              <div className="flex flex-col gap-3 p-4">
                <div className="grid grid-cols-3 gap-3">
                  {groups.map(({ parent }) => (
                    <Tile
                      key={parent.id}
                      icon={parent.icon}
                      label={parent.name}
                      mobile={mobile}
                      onClick={() => pickParent(parent.id)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => pickLeaf(null)}
                  className={cn(
                    "mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed bg-card px-3 py-3 text-muted-foreground transition hover:border-primary/40 hover:bg-accent/50 hover:text-foreground active:scale-[0.99]",
                    mobile ? "text-base" : "text-sm",
                  )}
                >
                  <MinusCircle className="h-4 w-4 opacity-60" />
                  {tCategories("noCategoryOption")}
                </button>
              </div>
            </section>
            <section
              className="h-full w-1/2 shrink-0 overflow-y-auto"
              aria-hidden={step !== "child"}
            >
              {selectedChildren.length === 0 ? (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  {tCategories("noSubcategoriesYet")}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 p-4">
                  {selectedChildren.map((child) => (
                    <Tile
                      key={child.id}
                      icon={child.icon}
                      label={child.name}
                      mobile={mobile}
                      selected={child.id === currentCategoryId}
                      onClick={() => pickLeaf(child.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({
  icon,
  label,
  onClick,
  selected,
  mobile,
}: {
  icon: string | null | undefined;
  label: string;
  onClick: () => void;
  selected?: boolean;
  mobile?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border bg-card p-3 text-center transition",
        "hover:border-primary/40 hover:bg-accent/50 active:scale-[0.97]",
        selected && "border-primary bg-primary/5",
      )}
    >
      <span className={cn("leading-none", mobile ? "text-4xl" : "text-3xl")}>
        {icon ?? "📁"}
      </span>
      <span
        className={cn(
          "line-clamp-2 break-words font-medium leading-tight",
          mobile ? "text-sm" : "text-xs",
        )}
      >
        {label}
      </span>
    </button>
  );
}
