"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Landmark,
  Plus,
  MoreHorizontal,
  Archive,
  Trash2,
  Pencil,
} from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";
import { FamilyFeatureTeaser } from "~/app/_components/billing/family-feature-teaser";
import { useEntitlements } from "~/app/_hooks/use-entitlements";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import {
  AssetFormDialog,
  assetTypeIcons,
  type AssetType,
} from "./_components/asset-form-dialog";

type Asset = RouterOutputs["asset"]["list"][number];

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return value < 0 ? `-${formatted} kr.` : `${formatted} kr.`;
}

function AssetCard({
  asset,
  archived = false,
  onEdit,
  onArchiveToggle,
  onDelete,
}: {
  asset: Asset;
  archived?: boolean;
  onEdit: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("assets");
  const tAccounts = useTranslations("accounts");
  const tCommon = useTranslations("common");
  const Icon = assetTypeIcons[asset.type as AssetType];

  const hasLoans = asset.linkedDebts.length > 0;
  const equityPct =
    asset.value > 0
      ? Math.max(0, Math.min(100, Math.round((asset.equity / asset.value) * 100)))
      : 0;
  const underwater = asset.equity < 0;

  return (
    <div
      className={`rounded-lg border border-border bg-card p-4 shadow-card ${archived ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
            <Icon className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">{asset.name}</p>
            <p className="text-xs text-muted-foreground">
              {t(`types.${asset.type as AssetType}`)}
            </p>
            <p className="mt-1 font-display text-lg text-foreground">
              {formatAmount(asset.value)}
            </p>
            {asset.note && (
              <p className="mt-1 text-xs text-muted-foreground">{asset.note}</p>
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
            <DropdownMenuItem onClick={onArchiveToggle}>
              <Archive />
              {archived ? tAccounts("unarchive") : tAccounts("archive")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={onDelete}
            >
              <Trash2 />
              {tCommon("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {hasLoans && (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t("equity")}</span>
            <span
              className={`font-medium ${underwater ? "text-debt" : "text-foreground"}`}
            >
              {formatAmount(asset.equity)} · {equityPct}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all ${underwater ? "bg-debt" : "bg-income"}`}
              style={{ width: `${equityPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("loanOutstanding", {
              count: asset.linkedDebts.length,
              amount: formatAmount(asset.debtOutstanding),
            })}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AssetsPage() {
  const t = useTranslations("assets");
  const tAccounts = useTranslations("accounts");
  const tTeaser = useTranslations("billing.featureCopy.assets");
  const utils = api.useUtils();
  const { has } = useEntitlements();

  const { data: assets, isLoading } = api.asset.list.useQuery(undefined, {
    enabled: has("assets"),
  });

  if (!has("assets")) {
    let bullets: string[] = [];
    try {
      bullets = (tTeaser.raw("bullets") as string[]) ?? [];
    } catch {
      bullets = [];
    }
    return <FamilyFeatureTeaser feature="assets" bullets={bullets} />;
  }
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);

  const updateAsset = api.asset.update.useMutation({
    onSuccess: () => {
      void utils.asset.list.invalidate();
      void utils.asset.summary.invalidate();
    },
  });

  const deleteAsset = api.asset.delete.useMutation({
    onSuccess: () => {
      void utils.asset.list.invalidate();
      void utils.asset.summary.invalidate();
    },
  });

  const activeAssets = assets?.filter((a) => !a.archived) ?? [];
  const archivedAssets = assets?.filter((a) => a.archived) ?? [];

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("addAsset")}
          </Button>
        }
      />

      {assets?.length === 0 ? (
        <EmptyState icon={Landmark} message={t("emptyState")} />
      ) : (
        <div className="space-y-6">
          {activeAssets.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeAssets.map((a) => (
                <AssetCard
                  key={a.id}
                  asset={a}
                  onEdit={() => setEditing(a)}
                  onArchiveToggle={() =>
                    updateAsset.mutate({ id: a.id, archived: true })
                  }
                  onDelete={() => deleteAsset.mutate({ id: a.id })}
                />
              ))}
            </div>
          )}

          {archivedAssets.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                {tAccounts("archived")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archivedAssets.map((a) => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    archived
                    onEdit={() => setEditing(a)}
                    onArchiveToggle={() =>
                      updateAsset.mutate({ id: a.id, archived: false })
                    }
                    onDelete={() => deleteAsset.mutate({ id: a.id })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AssetFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AssetFormDialog
        key={editing?.id}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        asset={editing ?? undefined}
      />
    </div>
  );
}
