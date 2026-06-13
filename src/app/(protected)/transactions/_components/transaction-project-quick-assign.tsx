"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import posthog from "posthog-js";

import { api, type RouterOutputs } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import { Button } from "~/app/_components/button";
import { cn } from "~/app/_lib/utils";

import { ProjectFormDialog } from "../../projects/_components/project-form-dialog";
import type { ProjectPalette } from "../../projects/_lib/format";

type Props = {
  transactionId: string | null;
  currentProjectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When supplied, the dialog defers the mutation to the caller and
  // closes after onPick returns. Used by the bulk-action flow.
  onPick?: (projectId: string | null) => void;
};

export function TransactionProjectQuickAssign({
  transactionId,
  currentProjectId,
  open,
  onOpenChange,
  onPick,
}: Props) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  const { data: projects = [] } = api.project.list.useQuery({
    includeArchived: false,
  });
  const [createOpen, setCreateOpen] = useState(false);

  type TxItem = RouterOutputs["transaction"]["list"]["items"][number];
  type ListPage = { items: TxItem[]; nextCursor: unknown };
  type InfiniteData = { pages: ListPage[]; pageParams: unknown[] };
  const transactionListKey: QueryKey = [["transaction", "list"]];

  const updateTx = api.transaction.update.useMutation({
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: transactionListKey });
      const snapshot = queryClient.getQueriesData<InfiniteData>({
        queryKey: transactionListKey,
      });
      queryClient.setQueriesData<InfiniteData>(
        { queryKey: transactionListKey },
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === variables.id
                  ? { ...item, projectId: variables.projectId ?? null }
                  : item,
              ),
            })),
          };
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
      posthog.capture("transaction_project_assigned", {
        transaction_id: variables.id,
        project_id: variables.projectId ?? null,
      });
    },
    onSettled: () => {
      void utils.transaction.list.invalidate();
      void utils.project.list.invalidate();
    },
  });

  function pickProject(projectId: string | null) {
    if (onPick) {
      onPick(projectId);
      onOpenChange(false);
      return;
    }
    if (!transactionId) return;
    updateTx.mutate({ id: transactionId, projectId });
    onOpenChange(false);
  }

  const visibleProjects = projects;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("quickAssign.title")}</DialogTitle>
            <DialogDescription>
              {t("quickAssign.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-2 max-h-[60vh] overflow-y-auto px-2">
            {visibleProjects.length === 0 ? (
              <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                {t("emptyState")}
              </p>
            ) : (
              <ul className="space-y-1">
                {visibleProjects.map((p) => {
                  const isCurrent = p.id === currentProjectId;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => pickProject(p.id)}
                        className={cn(
                          "hover:border-border hover:bg-accent flex w-full items-center gap-3 rounded-lg border border-transparent p-3 text-left transition",
                          isCurrent && "border-primary bg-primary/5",
                        )}
                      >
                        <span
                          data-project-palette={
                            p.coverPalette as ProjectPalette
                          }
                          className="project-cover-shimmer flex h-10 w-10 items-center justify-center rounded-md text-xl"
                        >
                          <span className="project-cover-emoji">{p.emoji}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground truncate font-medium">
                            {p.name}
                          </p>
                          {p.spendingLimit && (
                            <p className="text-muted-foreground truncate text-xs">
                              {Math.min(
                                100,
                                Math.round(
                                  (Math.max(0, p.net) / p.spendingLimit) * 100,
                                ),
                              )}
                              %
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-border space-y-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => setCreateOpen(true)}
            >
              {t("quickAssign.createNew")}
            </Button>
            {(currentProjectId != null || onPick != null) && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive w-full justify-start"
                onClick={() => pickProject(null)}
              >
                {t("quickAssign.remove")}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProjectFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(p) => {
          if (onPick) {
            onPick(p.id);
          } else if (transactionId) {
            updateTx.mutate({ id: transactionId, projectId: p.id });
          }
          onOpenChange(false);
        }}
      />
    </>
  );
}
