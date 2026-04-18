"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Wallet,
  Plus,
  MoreHorizontal,
  Archive,
  Trash2,
  Pencil,
  Lock,
} from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import {
  AccountFormDialog,
  accountTypeIcons,
  accountTypeKeys,
  type AccountType,
} from "~/app/(protected)/accounts/_components/account-form-dialog";

type Account = RouterOutputs["financialAccount"]["list"][number];

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return value < 0 ? `-${formatted} kr.` : `${formatted} kr.`;
}

function AccountCard({
  account,
  archived = false,
  onEdit,
  onArchiveToggle,
  onDelete,
}: {
  account: Account;
  archived?: boolean;
  onEdit: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("accounts");
  const tCommon = useTranslations("common");
  const Icon = accountTypeIcons[account.type as AccountType];

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <Link
      href={`/accounts/${account.id}`}
      className={`group relative flex items-start justify-between rounded-lg border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${archived ? "opacity-60" : ""}`}
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
          <Icon className="h-5 w-5 text-accent-foreground" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-foreground">{account.name}</p>
            {account.visibility === "private" && (
              <span
                className="flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                title={t("privateBadge")}
              >
                <Lock className="h-2.5 w-2.5" />
                {t("privateBadge")}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t(`types.${accountTypeKeys[account.type as AccountType]}`)}
          </p>
          <p className="mt-1 font-display text-lg text-foreground">
            {formatAmount(account.balance)}
          </p>
        </div>
      </div>
      <div onClick={stop}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={stop}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={stop}>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onEdit();
              }}
            >
              <Pencil />
              {tCommon("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onArchiveToggle();
              }}
            >
              <Archive />
              {archived ? t("unarchive") : t("archive")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                onDelete();
              }}
            >
              <Trash2 />
              {tCommon("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Link>
  );
}

export default function AccountsPage() {
  const t = useTranslations("accounts");
  const utils = api.useUtils();

  const { data: accounts, isLoading } = api.financialAccount.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const updateAccount = api.financialAccount.update.useMutation({
    onSuccess: () => {
      void utils.financialAccount.list.invalidate();
      void utils.financialAccount.summary.invalidate();
    },
  });

  const deleteAccount = api.financialAccount.delete.useMutation({
    onSuccess: () => {
      void utils.financialAccount.list.invalidate();
      void utils.financialAccount.summary.invalidate();
    },
  });

  const activeAccounts = accounts?.filter((a) => !a.archived) ?? [];
  const archivedAccounts = accounts?.filter((a) => a.archived) ?? [];

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("addAccount")}
          </Button>
        }
      />

      {accounts?.length === 0 ? (
        <EmptyState icon={Wallet} message={t("emptyState")} />
      ) : (
        <div className="space-y-6">
          {activeAccounts.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onEdit={() => setEditingAccount(account)}
                  onArchiveToggle={() =>
                    updateAccount.mutate({ id: account.id, archived: true })
                  }
                  onDelete={() => deleteAccount.mutate({ id: account.id })}
                />
              ))}
            </div>
          )}

          {archivedAccounts.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                {t("archived")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archivedAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    archived
                    onEdit={() => setEditingAccount(account)}
                    onArchiveToggle={() =>
                      updateAccount.mutate({ id: account.id, archived: false })
                    }
                    onDelete={() => deleteAccount.mutate({ id: account.id })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AccountFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AccountFormDialog
        key={editingAccount?.id}
        open={!!editingAccount}
        onOpenChange={(open) => !open && setEditingAccount(null)}
        account={editingAccount ?? undefined}
      />
    </div>
  );
}
