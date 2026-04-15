"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Wand2,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Play,
} from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";
import { Checkbox } from "~/app/_components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/app/_components/table";
import { RuleFormDialog } from "./_components/rule-form-dialog";

type Rule = RouterOutputs["categorizationRule"]["list"][number];

export default function RulesPage() {
  const t = useTranslations("rules");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();

  const { data: rules = [], isLoading } =
    api.categorizationRule.list.useQuery();
  const { data: categories = [] } = api.category.list.useQuery();
  const { data: preview } = api.categorizationRule.previewApply.useQuery();

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);

  const updateRule = api.categorizationRule.update.useMutation({
    onSuccess: () => {
      void utils.categorizationRule.list.invalidate();
      void utils.categorizationRule.previewApply.invalidate();
    },
  });

  const deleteRule = api.categorizationRule.delete.useMutation({
    onSuccess: () => {
      void utils.categorizationRule.list.invalidate();
      void utils.categorizationRule.previewApply.invalidate();
    },
  });

  const applyToExisting = api.categorizationRule.applyToExisting.useMutation({
    onSuccess: () => {
      void utils.transaction.list.invalidate();
      void utils.categorizationRule.previewApply.invalidate();
    },
  });

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <>
            <Button
              variant="outline"
              disabled={
                !preview || preview.matches === 0 || applyToExisting.isPending
              }
              onClick={() => applyToExisting.mutate()}
            >
              <Play />
              {t("applyToExisting")}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("addRule")}
            </Button>
          </>
        }
      />

      {preview && preview.matches > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("applyPreview", {
            matches: preview.matches,
            uncategorized: preview.uncategorized,
          })}
        </p>
      )}

      {applyToExisting.data && (
        <p className="text-sm text-income">
          {t("applySuccess", { count: applyToExisting.data.updated })}
        </p>
      )}

      {rules.length === 0 ? (
        <EmptyState icon={Wand2} message={t("emptyState")} />
      ) : (
        <div className="rounded-lg border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">{t("enabled")}</TableHead>
                <TableHead>{t("pattern")}</TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead className="w-[100px] text-right">
                  {t("priority")}
                </TableHead>
                <TableHead className="w-[48px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => {
                const category = categoryMap.get(rule.categoryId);
                return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Checkbox
                        checked={rule.enabled}
                        onCheckedChange={(checked) =>
                          updateRule.mutate({
                            id: rule.id,
                            enabled: checked === true,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {rule.pattern}
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
                    <TableCell className="text-right text-muted-foreground">
                      {rule.priority}
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
                          <DropdownMenuItem onClick={() => setEditing(rule)}>
                            <Pencil />
                            {tCommon("edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              deleteRule.mutate({ id: rule.id })
                            }
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

      <RuleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        categories={categories}
      />
      <RuleFormDialog
        key={editing?.id}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        rule={editing ?? undefined}
        categories={categories}
      />
    </div>
  );
}
