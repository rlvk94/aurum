"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Wallet,
  Plus,
  Landmark,
  CreditCard,
  Banknote,
  Smartphone,
  MoreHorizontal,
  Archive,
  Trash2,
  CircleDollarSign,
} from "lucide-react";
import { api } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";

const accountTypeIcons = {
  checking: Landmark,
  savings: CircleDollarSign,
  cash: Banknote,
  credit_card: CreditCard,
  e_wallet: Smartphone,
  other: Wallet,
} as const;

type AccountType = keyof typeof accountTypeIcons;

const accountTypeKeys: Record<AccountType, string> = {
  checking: "checking",
  savings: "savings",
  cash: "cash",
  credit_card: "creditCard",
  e_wallet: "eWallet",
  other: "other",
};

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return value < 0 ? `-${formatted} kr.` : `${formatted} kr.`;
}

export default function AccountsPage() {
  const t = useTranslations("accounts");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();

  const { data: accounts, isLoading } = api.financialAccount.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [institution, setInstitution] = useState("");
  const [balance, setBalance] = useState("");
  const [includeInNetWorth, setIncludeInNetWorth] = useState(true);

  const createAccount = api.financialAccount.create.useMutation({
    onSuccess: () => {
      setCreateOpen(false);
      resetForm();
      void utils.financialAccount.list.invalidate();
    },
  });

  const updateAccount = api.financialAccount.update.useMutation({
    onSuccess: () => {
      void utils.financialAccount.list.invalidate();
    },
  });

  const deleteAccount = api.financialAccount.delete.useMutation({
    onSuccess: () => {
      void utils.financialAccount.list.invalidate();
    },
  });

  const resetForm = () => {
    setName("");
    setIdentifier("");
    setType("checking");
    setInstitution("");
    setBalance("");
    setIncludeInNetWorth(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createAccount.mutate({
      name: name.trim(),
      identifier: identifier.trim(),
      type,
      institution: institution.trim() || undefined,
      balance: Math.round(parseFloat(balance || "0") * 100),
      includeInNetWorth,
    });
  };

  const activeAccounts = accounts?.filter((a) => !a.archived) ?? [];
  const archivedAccounts = accounts?.filter((a) => a.archived) ?? [];

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
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
              {activeAccounts.map((account) => {
                const Icon = accountTypeIcons[account.type as AccountType];
                return (
                  <div
                    key={account.id}
                    className="flex items-start justify-between rounded-lg border border-border bg-card p-4 shadow-card"
                  >
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                        <Icon className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {account.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t(`types.${accountTypeKeys[account.type as AccountType]}`)}
                          {account.institution && ` · ${account.institution}`}
                        </p>
                        <p className="mt-1 font-display text-lg text-foreground">
                          {formatAmount(account.balance)}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            updateAccount.mutate({
                              id: account.id,
                              archived: true,
                            })
                          }
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          {t("archived")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            deleteAccount.mutate({ id: account.id })
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {tCommon("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}

          {archivedAccounts.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                {t("archived")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archivedAccounts.map((account) => {
                  const Icon = accountTypeIcons[account.type as AccountType];
                  return (
                    <div
                      key={account.id}
                      className="flex items-start justify-between rounded-lg border border-border bg-card p-4 opacity-60 shadow-card"
                    >
                      <div className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                          <Icon className="h-5 w-5 text-accent-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {account.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t(`types.${accountTypeKeys[account.type as AccountType]}`)}
                          </p>
                          <p className="mt-1 font-display text-lg text-foreground">
                            {formatAmount(account.balance)}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              updateAccount.mutate({
                                id: account.id,
                                archived: false,
                              })
                            }
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            {t("active")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              deleteAccount.mutate({ id: account.id })
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {tCommon("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create account dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addAccount")}</DialogTitle>
            <DialogDescription>{t("emptyState")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="accountName" className="text-sm font-medium">
                {t("accountName")}
              </label>
              <Input
                id="accountName"
                placeholder={t("accountName")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="identifier" className="text-sm font-medium">
                {t("accountIdentifier")}
              </label>
              <Input
                id="identifier"
                placeholder={t("accountIdentifierPlaceholder")}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("accountType")}</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(accountTypeIcons) as AccountType[]).map((t2) => {
                  const Icon = accountTypeIcons[t2];
                  return (
                    <button
                      key={t2}
                      type="button"
                      onClick={() => setType(t2)}
                      className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-all ${
                        type === t2
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {t(`types.${accountTypeKeys[t2]}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="institution" className="text-sm font-medium">
                {t("institution")}
              </label>
              <Input
                id="institution"
                placeholder={t("institution")}
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="balance" className="text-sm font-medium">
                {t("openingBalance")}
              </label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                placeholder="0"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeInNetWorth}
                onChange={(e) => setIncludeInNetWorth(e.target.checked)}
                className="rounded border-input"
              />
              {t("includeInNetWorth")}
            </label>

            {createAccount.error && (
              <p className="text-sm text-destructive">{tCommon("error")}</p>
            )}

            <DialogFooter>
              <Button
                type="submit"
                disabled={!name.trim() || !identifier.trim() || createAccount.isPending}
              >
                {createAccount.isPending ? tCommon("loading") : tCommon("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
