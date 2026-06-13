"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Tag,
  Plus,
  Play,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  ChevronRight,
  Maximize2,
  Minimize2,
  RotateCcw,
} from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/app/_components/badge";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import { cn } from "~/app/_lib/utils";
import { CategoryFormDialog } from "./_components/category-form-dialog";

type Category = RouterOutputs["category"]["list"][number];

type FormState =
  | { mode: "create"; defaultParentId?: string }
  | { mode: "edit"; category: Category }
  | null;

const COLLAPSED_STORAGE_KEY = "aurum:categories:collapsed";

function loadCollapsed(): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return null;
    return new Set(arr.filter((v): v is string => typeof v === "string"));
  } catch {
    return null;
  }
}

function saveCollapsed(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COLLAPSED_STORAGE_KEY,
      JSON.stringify(Array.from(ids)),
    );
  } catch {
    // ignore quota / disabled storage
  }
}

export default function CategoriesPage() {
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();

  const { data: categories = [], isLoading } = api.category.list.useQuery();
  const { data: currentFamily } = api.family.current.useQuery();
  const isOwner = currentFamily?.role === "owner";
  const [form, setForm] = useState<FormState>(null);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [resetOpen, setResetOpen] = useState(false);

  const deleteCategory = api.category.delete.useMutation({
    onSuccess: () => {
      void utils.category.list.invalidate();
      void utils.transaction.list.invalidate();
      void utils.challenge.list.invalidate();
      void utils.challenge.get.invalidate();
    },
  });

  const autoCategorize = api.category.autoCategorize.useMutation({
    onSuccess: () => {
      void utils.transaction.list.invalidate();
      void utils.challenge.list.invalidate();
      void utils.challenge.get.invalidate();
    },
  });

  const resetRules = api.category.resetRules.useMutation({
    onSuccess: () => setResetOpen(false),
  });

  const visible = useMemo(
    () => categories.filter((c) => !c.archived),
    [categories],
  );

  const groups = useMemo(() => {
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
  }, [visible]);

  // Hydrate persisted collapse state once. Default: every parent collapsed.
  useEffect(() => {
    const persisted = loadCollapsed();
    if (persisted) {
      setCollapsed(persisted);
    } else {
      setCollapsed(new Set(groups.map((g) => g.parent.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matchesSearch = (cat: Category, parentName?: string) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    if (cat.name.toLowerCase().includes(q)) return true;
    if (parentName?.toLowerCase().includes(q)) return true;
    return false;
  };

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    return groups
      .map(({ parent, children }) => {
        const parentMatch = matchesSearch(parent);
        const filteredChildren = children.filter((c) =>
          matchesSearch(c, parent.name),
        );
        if (!parentMatch && filteredChildren.length === 0) return null;
        return { parent, children: parentMatch ? children : filteredChildren };
      })
      .filter(
        (g): g is { parent: Category; children: Category[] } => g !== null,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, search]);

  const isExpanded = (parentId: string) =>
    Boolean(search.trim()) || !collapsed.has(parentId);

  const toggle = (parentId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      saveCollapsed(next);
      return next;
    });
  };

  const expandAll = () => {
    const next = new Set<string>();
    saveCollapsed(next);
    setCollapsed(next);
  };

  const collapseAll = () => {
    const next = new Set(groups.map((g) => g.parent.id));
    saveCollapsed(next);
    setCollapsed(next);
  };

  const allCollapsed =
    groups.length > 0 && groups.every((g) => collapsed.has(g.parent.id));

  if (isLoading) return null;

  return (
    <div className="container mx-auto space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <>
            {isOwner && (
              <Button
                variant="outline"
                onClick={() => setResetOpen(true)}
                disabled={resetRules.isPending}
              >
                <RotateCcw />
                {t("resetRules")}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => autoCategorize.mutate()}
              disabled={autoCategorize.isPending}
            >
              <Play />
              {t("autoCategorize")}
            </Button>
            <Button onClick={() => setForm({ mode: "create" })}>
              <Plus />
              {t("addCategory")}
            </Button>
          </>
        }
      />

      {autoCategorize.data && autoCategorize.data.updated > 0 && (
        <p className="text-income text-sm">
          {t("applySuccess", { count: autoCategorize.data.updated })}
        </p>
      )}

      {categories.length === 0 ? (
        <EmptyState icon={Tag} message={t("emptyState")} />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchCategoriesPlaceholder")}
                className="pl-9"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={allCollapsed ? expandAll : collapseAll}
              disabled={Boolean(search.trim())}
            >
              {allCollapsed ? <Maximize2 /> : <Minimize2 />}
              {allCollapsed ? t("expandAll") : t("collapseAll")}
            </Button>
          </div>

          {filteredGroups.length === 0 ? (
            <EmptyState icon={Search} message={t("noCategoriesMatch")} />
          ) : (
            <div className="space-y-3">
              {filteredGroups.map(({ parent, children }) => {
                const expanded = isExpanded(parent.id);
                return (
                  <section
                    key={parent.id}
                    className="border-border bg-card shadow-card overflow-hidden rounded-xl border"
                  >
                    <header className="flex items-center gap-2 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggle(parent.id)}
                        className="flex flex-1 items-center gap-3 text-left"
                        aria-expanded={expanded}
                      >
                        <ChevronRight
                          className={cn(
                            "text-muted-foreground h-4 w-4 shrink-0 transition-transform",
                            expanded && "rotate-90",
                          )}
                        />
                        <span className="text-xl">{parent.icon ?? "📁"}</span>
                        <span className="font-display text-base">
                          {parent.name}
                        </span>
                        <Badge variant="secondary" className="ml-2">
                          {t("childCount", { count: children.length })}
                        </Badge>
                      </button>
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
                          <DropdownMenuItem
                            onClick={() =>
                              setForm({ mode: "edit", category: parent })
                            }
                          >
                            <Pencil />
                            {tCommon("edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setForm({
                                mode: "create",
                                defaultParentId: parent.id,
                              })
                            }
                          >
                            <Plus />
                            {t("addSubcategory")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              deleteCategory.mutate({ id: parent.id })
                            }
                          >
                            <Trash2 />
                            {tCommon("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </header>
                    {expanded && (
                      <div className="border-border bg-background/40 grid gap-2 border-t p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {children.map((child) => (
                          <ChildTile
                            key={child.id}
                            category={child}
                            onEdit={() =>
                              setForm({ mode: "edit", category: child })
                            }
                            onDelete={() =>
                              deleteCategory.mutate({ id: child.id })
                            }
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              mode: "create",
                              defaultParentId: parent.id,
                            })
                          }
                          className="border-border bg-card/50 text-muted-foreground hover:border-primary/40 hover:bg-accent/30 hover:text-foreground flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm transition"
                        >
                          <Plus className="h-4 w-4" />
                          {t("addSubcategory")}
                        </button>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      <CategoryFormDialog
        open={form?.mode === "create"}
        onOpenChange={(open) => {
          if (!open) setForm(null);
        }}
        allCategories={categories}
        defaultParentId={
          form?.mode === "create" ? form.defaultParentId : undefined
        }
      />
      <CategoryFormDialog
        key={form?.mode === "edit" ? form.category.id : "edit-empty"}
        open={form?.mode === "edit"}
        onOpenChange={(open) => {
          if (!open) setForm(null);
        }}
        category={form?.mode === "edit" ? form.category : undefined}
        allCategories={categories}
      />

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("resetRulesTitle")}</DialogTitle>
            <DialogDescription>{t("resetRulesBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              disabled={resetRules.isPending}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => resetRules.mutate()}
              disabled={resetRules.isPending}
            >
              {resetRules.isPending
                ? tCommon("loading")
                : t("resetRulesConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChildTile({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tCommon = useTranslations("common");
  return (
    <div className="border-border bg-card flex items-center gap-2 rounded-lg border px-3 py-2">
      <span className="text-lg leading-none">{category.icon ?? "📁"}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {category.name}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="-mr-1 h-7 w-7">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil />
            {tCommon("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={onDelete}>
            <Trash2 />
            {tCommon("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
