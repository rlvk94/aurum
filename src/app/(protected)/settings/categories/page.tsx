"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Tag,
  Plus,
  Play,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/app/_components/badge";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import { CategoryFormDialog } from "./_components/category-form-dialog";

type Category = RouterOutputs["category"]["list"][number];

function CategoryRow({
  category,
  child = false,
  onEdit,
  onDelete,
}: {
  category: Category;
  child?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tCommon = useTranslations("common");
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 ${child ? "ml-6" : ""}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{category.icon ?? "📁"}</span>
        <div>
          <span className="font-medium text-foreground">{category.name}</span>
          {category.keywords.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {category.keywords.map((kw, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {kw}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
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

function CategoryGroup({
  title,
  categories,
  allCategories,
  onEdit,
  onDelete,
}: {
  title: string;
  categories: Category[];
  allCategories: Category[];
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  const topLevel = categories.filter((c) => !c.parentId);
  const byParent = new Map<string, Category[]>();
  for (const c of categories) {
    if (c.parentId) {
      const list = byParent.get(c.parentId) ?? [];
      list.push(c);
      byParent.set(c.parentId, list);
    }
  }

  if (categories.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="space-y-2">
        {topLevel.map((parent) => (
          <div key={parent.id} className="space-y-2">
            <CategoryRow
              category={parent}
              onEdit={() => onEdit(parent)}
              onDelete={() => onDelete(parent)}
            />
            {(byParent.get(parent.id) ?? []).map((child) => (
              <CategoryRow
                key={child.id}
                category={child}
                child
                onEdit={() => onEdit(child)}
                onDelete={() => onDelete(child)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const t = useTranslations("categories");
  const utils = api.useUtils();

  const { data: categories = [], isLoading } = api.category.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const deleteCategory = api.category.delete.useMutation({
    onSuccess: () => {
      void utils.category.list.invalidate();
      void utils.transaction.list.invalidate();
    },
  });

  const applyKeywords = api.category.applyKeywords.useMutation({
    onSuccess: () => {
      void utils.transaction.list.invalidate();
    },
  });

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === "expense" && !c.archived),
    [categories],
  );
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.kind === "income" && !c.archived),
    [categories],
  );

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => applyKeywords.mutate()}
              disabled={applyKeywords.isPending}
            >
              <Play />
              {t("applyKeywords")}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("addCategory")}
            </Button>
          </>
        }
      />

      {applyKeywords.data && applyKeywords.data.updated > 0 && (
        <p className="text-sm text-income">
          {t("applySuccess", { count: applyKeywords.data.updated })}
        </p>
      )}

      {categories.length === 0 ? (
        <EmptyState icon={Tag} message={t("emptyState")} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <CategoryGroup
            title={t("expenseCategories")}
            categories={expenseCategories}
            allCategories={categories}
            onEdit={setEditing}
            onDelete={(c) => deleteCategory.mutate({ id: c.id })}
          />
          <CategoryGroup
            title={t("incomeCategories")}
            categories={incomeCategories}
            allCategories={categories}
            onEdit={setEditing}
            onDelete={(c) => deleteCategory.mutate({ id: c.id })}
          />
        </div>
      )}

      <CategoryFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        allCategories={categories}
      />
      <CategoryFormDialog
        key={editing?.id}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        category={editing ?? undefined}
        allCategories={categories}
      />
    </div>
  );
}
