"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";

import { cn } from "~/app/_lib/utils";
import { api } from "~/trpc/react";
import { useIsMobile } from "~/app/_hooks/use-mobile";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { CategorySelect } from "~/app/_components/category-select";
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

// The transaction the user acted on. For a normal row this is the original to
// split; for a part row this is a part, and the dialog resolves its parent.
export type SplitTarget = {
  id: string;
  amount: number;
  splitParentId: string | null;
};

function formatAmount(cents: number): string {
  const value = cents / 100;
  return `${new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} kr.`;
}

function toCents(value: string): number | null {
  const n = parseFloat(value.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

type PartRow = {
  amount: string;
  categoryId: string | null;
  note: string;
};

function emptyRow(): PartRow {
  return { amount: "", categoryId: null, note: "" };
}

function invalidateAll(utils: ReturnType<typeof api.useUtils>) {
  void utils.transaction.list.invalidate();
  void utils.financialAccount.list.invalidate();
  void utils.financialAccount.get.invalidate();
  void utils.financialAccount.summary.invalidate();
  void utils.challenge.list.invalidate();
  void utils.challenge.get.invalidate();
  void utils.budget.list.invalidate();
}

export function TransactionSplitDialog({
  target,
  open,
  onOpenChange,
}: {
  target: SplitTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("transactions");
  const isMobile = useIsMobile();
  const isExisting = target?.splitParentId != null;
  const flowKey = `${target?.id ?? "none"}:${open}`;

  const body = target ? (
    <SplitFlow
      key={flowKey}
      target={target}
      isExisting={isExisting}
      onClose={() => onOpenChange(false)}
    />
  ) : null;

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("splitTransaction")}</DialogTitle>
            <DialogDescription>{t("splitDescription")}</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader>
          <DrawerTitle>{t("splitTransaction")}</DrawerTitle>
          <DrawerDescription>{t("splitDescription")}</DrawerDescription>
        </DrawerHeader>
        {body}
      </DrawerContent>
    </Drawer>
  );
}

function SplitFlow({
  target,
  isExisting,
  onClose,
}: {
  target: SplitTarget;
  isExisting: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();

  const { data: categories = [] } = api.category.list.useQuery();

  // For an existing split, load the original (full amount + bank ref) and its
  // current parts to prefill the editor.
  const { data: splitData, isLoading: splitLoading } =
    api.transaction.getSplit.useQuery(
      { transactionId: target.id },
      { enabled: isExisting },
    );

  const originalAmount = isExisting
    ? (splitData?.original.amount ?? 0)
    : target.amount;

  const initialRows = useMemo<PartRow[]>(() => {
    if (isExisting) {
      if (!splitData) return [];
      return splitData.parts.map((p) => ({
        amount: String(p.amount / 100),
        categoryId: p.categoryId,
        note: p.note ?? "",
      }));
    }
    return [emptyRow(), emptyRow()];
  }, [isExisting, splitData]);

  const [rows, setRows] = useState<PartRow[] | null>(null);
  const effectiveRows = rows ?? initialRows;

  function update(next: PartRow[]) {
    setRows(next);
  }

  const sumCents = effectiveRows.reduce((acc, r) => {
    const c = toCents(r.amount);
    return acc + (c && c > 0 ? c : 0);
  }, 0);
  const remaining = originalAmount - sumCents;

  const allAmountsValid =
    effectiveRows.length >= 2 &&
    effectiveRows.every((r) => {
      const c = toCents(r.amount);
      return c !== null && c > 0;
    });
  const canSave = allAmountsValid && remaining === 0;

  const splitMut = api.transaction.split.useMutation();
  const updateMut = api.transaction.updateSplit.useMutation();
  const unsplitMut = api.transaction.unsplit.useMutation();
  const pending =
    splitMut.isPending || updateMut.isPending || unsplitMut.isPending;

  function handleSave() {
    if (!canSave) return;
    const parts = effectiveRows.map((r) => ({
      amount: toCents(r.amount)!,
      categoryId: r.categoryId ?? undefined,
      note: r.note.trim() || undefined,
    }));
    const originalId = target.splitParentId ?? target.id;
    const onSuccess = () => {
      posthog.capture(isExisting ? "transaction_split_edited" : "transaction_split", {
        parts: parts.length,
      });
      invalidateAll(utils);
      onClose();
    };
    if (isExisting) {
      updateMut.mutate({ transactionId: originalId, parts }, { onSuccess });
    } else {
      splitMut.mutate({ transactionId: originalId, parts }, { onSuccess });
    }
  }

  function handleUnsplit() {
    const originalId = target.splitParentId ?? target.id;
    unsplitMut.mutate(
      { transactionId: originalId },
      {
        onSuccess: () => {
          posthog.capture("transaction_unsplit");
          invalidateAll(utils);
          onClose();
        },
      },
    );
  }

  if (isExisting && splitLoading) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        {tCommon("loading")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 sm:px-0">
      {isExisting && splitData && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {t("originalTransaction")}:
          </span>{" "}
          {splitData.original.description} · {formatAmount(originalAmount)}
          {splitData.original.externalId && (
            <>
              {" · "}
              {t("bankReference")}: {splitData.original.externalId}
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {effectiveRows.map((row, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-border p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t("part", { index: i + 1 })}
              </span>
              {effectiveRows.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={t("removePart")}
                  onClick={() =>
                    update(effectiveRows.filter((_, idx) => idx !== i))
                  }
                >
                  <Trash2 />
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0,00"
                value={row.amount}
                className="sm:w-36"
                onChange={(e) =>
                  update(
                    effectiveRows.map((r, idx) =>
                      idx === i ? { ...r, amount: e.target.value } : r,
                    ),
                  )
                }
              />
              <div className="flex-1">
                <CategorySelect
                  value={row.categoryId}
                  onChange={(v) =>
                    update(
                      effectiveRows.map((r, idx) =>
                        idx === i ? { ...r, categoryId: v } : r,
                      ),
                    )
                  }
                  categories={categories}
                  mode="leaf-only"
                  emptyOption="none"
                  placeholder={tCommon("category")}
                />
              </div>
            </div>
            <Input
              value={row.note}
              placeholder={t("notePlaceholder")}
              onChange={(e) =>
                update(
                  effectiveRows.map((r, idx) =>
                    idx === i ? { ...r, note: e.target.value } : r,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => update([...effectiveRows, emptyRow()])}
        className="self-start"
      >
        <Plus />
        {t("addPart")}
      </Button>

      <div
        className={cn(
          "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
          remaining === 0
            ? "border-income/40 text-income"
            : "border-warning/40 text-warning",
        )}
      >
        <span>{t("remaining")}</span>
        <span className="font-medium tabular-nums">
          {formatAmount(remaining)}
        </span>
      </div>
      {remaining !== 0 && (
        <p className="-mt-2 text-xs text-muted-foreground">
          {t("mustSumToTotal")}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        {isExisting ? (
          <Button
            type="button"
            variant="outline"
            className="text-destructive"
            onClick={handleUnsplit}
            disabled={pending}
          >
            {t("unsplit")}
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" onClick={handleSave} disabled={!canSave || pending}>
          {pending ? tCommon("loading") : tCommon("save")}
        </Button>
      </div>
    </div>
  );
}

export function TransactionInspectDialog({
  transactionId,
  open,
  onOpenChange,
}: {
  transactionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();

  const { data, isLoading } = api.transaction.getSplit.useQuery(
    { transactionId: transactionId! },
    { enabled: open && transactionId !== null },
  );

  const { data: categories = [] } = api.category.list.useQuery();
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const content = (
    <div className="flex flex-col gap-4 px-4 pb-4 sm:px-0">
      {isLoading || !data ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          {tCommon("loading")}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">{tCommon("date")}</dt>
            <dd className="text-right">{data.original.date}</dd>
            <dt className="text-muted-foreground">{t("descriptionLabel")}</dt>
            <dd className="text-right">{data.original.description}</dd>
            <dt className="text-muted-foreground">{t("amount")}</dt>
            <dd className="text-right font-medium tabular-nums">
              {formatAmount(data.original.amount)}
            </dd>
            <dt className="text-muted-foreground">{t("account")}</dt>
            <dd className="text-right">{data.original.accountName}</dd>
            {data.original.externalId && (
              <>
                <dt className="text-muted-foreground">{t("bankReference")}</dt>
                <dd className="text-right break-all">
                  {data.original.externalId}
                </dd>
              </>
            )}
          </dl>
          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("splitInto", { count: data.parts.length })}
            </p>
            <ul className="space-y-1.5">
              {data.parts.map((p) => {
                const cat = p.categoryId
                  ? categoryMap.get(p.categoryId)
                  : null;
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="inline-flex items-center gap-1">
                      {cat?.icon && <span>{cat.icon}</span>}
                      {cat?.name ?? t("uncategorizedFilter")}
                    </span>
                    <span className="tabular-nums">
                      {formatAmount(p.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("originalTransaction")}</DialogTitle>
            <DialogDescription>{t("inspectOriginal")}</DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader>
          <DrawerTitle>{t("originalTransaction")}</DrawerTitle>
          <DrawerDescription>{t("inspectOriginal")}</DrawerDescription>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
}
