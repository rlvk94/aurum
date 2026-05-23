"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Badge } from "~/app/_components/badge";
import { Input } from "~/app/_components/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import { usePageMetadata } from "~/app/_components/page-metadata";
import { cn } from "~/app/_lib/utils";
import { SavingsDialog } from "~/app/(protected)/accounts/[id]/_components/savings-dialog";

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
  return value < 0 ? `-${formatted} kr.` : `${formatted} kr.`;
}

export function SavingsDetailClient({
  accountId,
  savingsId,
}: {
  accountId: string;
  savingsId: string;
}) {
  const t = useTranslations("savings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const utils = api.useUtils();

  const { data: savings } = api.savings.get.useQuery({ id: savingsId });
  const { data: account } = api.financialAccount.get.useQuery({ id: accountId });
  const { data: txData } = api.savings.listTransactions.useQuery({
    savingsId,
    limit: 50,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState<null | "deposit" | "withdraw">(null);
  const [amountInput, setAmountInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  usePageMetadata(
    savings && account
      ? {
          title: savings.name,
          parentPath: `/accounts/${accountId}`,
        }
      : null,
  );

  const invalidate = () => {
    void utils.savings.get.invalidate({ id: savingsId });
    void utils.savings.listTransactions.invalidate({ savingsId });
    void utils.savings.list.invalidate();
    void utils.savings.reservedByAccount.invalidate();
    void utils.financialAccount.summary.invalidate();
  };

  const deposit = api.savings.deposit.useMutation({
    onSuccess: () => {
      setMoveOpen(null);
      setAmountInput("");
      setNoteInput("");
      invalidate();
    },
  });
  const withdraw = api.savings.withdraw.useMutation({
    onSuccess: () => {
      setMoveOpen(null);
      setAmountInput("");
      setNoteInput("");
      invalidate();
    },
  });
  const update = api.savings.update.useMutation({ onSuccess: invalidate });
  const archive = api.savings.archive.useMutation({
    onSuccess: () => {
      invalidate();
      router.push(`/accounts/${accountId}`);
    },
  });
  const remove = api.savings.delete.useMutation({
    onSuccess: () => {
      invalidate();
      router.push(`/accounts/${accountId}`);
    },
  });

  if (!savings || !account) {
    return (
      <div className="container">
        <p className="text-muted-foreground">{t("detail.notFound")}</p>
      </div>
    );
  }

  const progress =
    savings.targetAmount > 0
      ? Math.min(1, Math.max(0, savings.balance / savings.targetAmount))
      : 0;
  const status: "completed" | "paused" | "active" | "archived" =
    savings.archived
      ? "archived"
      : savings.completedAt
        ? "completed"
        : savings.pausedAt
          ? "paused"
          : "active";

  const isPaused = Boolean(savings.pausedAt);
  const canAutoToggle = savings.transferMode !== "manual" && !savings.archived;

  const submitMove = () => {
    const amount = Math.round(parseFloat(amountInput) * 100);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (moveOpen === "deposit") {
      deposit.mutate({
        id: savingsId,
        amount,
        note: noteInput.trim() || undefined,
      });
    } else if (moveOpen === "withdraw") {
      withdraw.mutate({
        id: savingsId,
        amount,
        note: noteInput.trim() || undefined,
      });
    }
  };

  return (
    <div className="container space-y-6">
      {/* Hero */}
      <div
        data-project-palette={savings.color}
        className="project-cover-shimmer relative isolate overflow-hidden rounded-2xl p-6 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="project-cover-emoji text-5xl leading-none sm:text-6xl"
            >
              {savings.emoji}
            </span>
            <div>
              <p className="text-sm opacity-80">{account.name}</p>
              <h1 className="font-display text-2xl sm:text-3xl">
                {savings.name}
              </h1>
              {status !== "active" && (
                <Badge
                  variant={status === "completed" ? "default" : "secondary"}
                  className="mt-2"
                >
                  {t(`status.${status}`)}
                </Badge>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 bg-background/20 text-[var(--cover-glyph)] hover:bg-background/30"
                aria-label={tCommon("more")}
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil />
                {tCommon("edit")}
              </DropdownMenuItem>
              {canAutoToggle && (
                <DropdownMenuItem
                  onSelect={() =>
                    update.mutate({ id: savingsId, paused: !isPaused })
                  }
                >
                  {isPaused ? <Play /> : <Pause />}
                  {isPaused ? t("detail.resume") : t("detail.pause")}
                </DropdownMenuItem>
              )}
              {!savings.archived && (
                <DropdownMenuItem
                  onSelect={() => archive.mutate({ id: savingsId })}
                >
                  <Archive />
                  {t("detail.archive")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmDelete(true);
                }}
              >
                <Trash2 />
                {tCommon("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-4xl sm:text-5xl">
              {formatAmount(savings.balance)}
            </p>
            <p className="text-sm opacity-80">
              {t("detail.of", { target: formatAmount(savings.targetAmount) })}
            </p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background/25">
            <div
              className="h-full rounded-full bg-[var(--cover-glyph)] transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs opacity-80">
            {Math.round(progress * 100)}%
          </p>
        </div>
      </div>

      {/* Move money */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMoveOpen("deposit")}
          disabled={savings.archived}
          className={cn(
            "group flex items-center justify-between gap-3 rounded-xl border border-income/30 bg-income/10 p-4 text-left shadow-card transition",
            "hover:bg-income/15 hover:shadow-elevated",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <div>
            <p className="font-display text-lg text-income">
              {t("detail.deposit")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("detail.depositHint")}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-income/20 text-income transition group-hover:bg-income/30">
            <ArrowDownToLine className="h-5 w-5" />
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMoveOpen("withdraw")}
          disabled={savings.archived || savings.balance <= 0}
          className={cn(
            "group flex items-center justify-between gap-3 rounded-xl border border-expense/30 bg-expense/10 p-4 text-left shadow-card transition",
            "hover:bg-expense/15 hover:shadow-elevated",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <div>
            <p className="font-display text-lg text-expense">
              {t("detail.withdraw")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("detail.withdrawHint")}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-expense/20 text-expense transition group-hover:bg-expense/30">
            <ArrowUpFromLine className="h-5 w-5" />
          </div>
        </button>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.history")}</CardTitle>
          <CardDescription>{t("detail.historyDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {!txData || txData.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("detail.historyEmpty")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {txData.items.map((row) => {
                const positive = row.amount > 0;
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {t(`source.${row.source}`)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.date}
                        {row.note ? ` • ${row.note}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "font-medium",
                        positive ? "text-income" : "text-expense",
                      )}
                    >
                      {positive ? "+" : ""}
                      {formatAmount(row.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <SavingsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        accountId={accountId}
        savings={savings}
      />

      <Dialog
        open={moveOpen !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMoveOpen(null);
            setAmountInput("");
            setNoteInput("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {moveOpen === "deposit"
                ? t("detail.depositTitle")
                : t("detail.withdrawTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="number"
              step="1"
              min="0"
              placeholder="0"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              autoFocus
            />
            <Input
              placeholder={t("detail.notePlaceholder")}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={submitMove}
              disabled={deposit.isPending || withdraw.isPending}
            >
              {moveOpen === "deposit"
                ? t("detail.deposit")
                : t("detail.withdraw")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("detail.confirmDeleteTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("detail.confirmDeleteBody")}
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => remove.mutate({ id: savingsId })}
              disabled={remove.isPending}
            >
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
