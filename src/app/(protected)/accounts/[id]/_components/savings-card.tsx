"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, Target } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { useIsMobile } from "~/app/_hooks/use-mobile";
import { Button } from "~/app/_components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import { Badge } from "~/app/_components/badge";
import { cn } from "~/app/_lib/utils";
import { SavingsDialog } from "./savings-dialog";

type Savings = RouterOutputs["savings"]["list"][number];

function formatAmount(cents: number): string {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
  return value < 0 ? `-${formatted} kr.` : `${formatted} kr.`;
}

function SavingsRow({
  accountId,
  savings,
}: {
  accountId: string;
  savings: Savings;
}) {
  const t = useTranslations("savings");
  const progress =
    savings.targetAmount > 0
      ? Math.min(1, Math.max(0, savings.balance / savings.targetAmount))
      : 0;
  const status: "completed" | "paused" | "active" = savings.completedAt
    ? "completed"
    : savings.pausedAt
      ? "paused"
      : "active";

  return (
    <Link
      href={`/accounts/${accountId}/savings/${savings.id}`}
      className="border-border hover:shadow-card focus-visible:ring-ring block rounded-lg border p-3 transition-shadow focus:outline-none focus-visible:ring-2"
    >
      <div className="flex items-center gap-3">
        <div
          data-project-palette={savings.color}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-lg"
        >
          {savings.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{savings.name}</p>
            {status !== "active" && (
              <Badge
                variant={status === "completed" ? "default" : "secondary"}
                className="text-[10px]"
              >
                {t(`status.${status}`)}
              </Badge>
            )}
            <span className="text-muted-foreground text-[10px]">
              {t(`mode.${savings.transferMode}Short`)}
            </span>
          </div>
          <div className="text-muted-foreground mt-1 flex items-baseline justify-between gap-2 text-xs">
            <span>
              {formatAmount(savings.balance)} /{" "}
              {formatAmount(savings.targetAmount)}
            </span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                status === "completed" ? "bg-income" : "bg-primary",
              )}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

export function SavingsCard({
  accountId,
  accountArchived,
}: {
  accountId: string;
  accountArchived: boolean;
}) {
  const t = useTranslations("savings");
  const { data: savings = [] } = api.savings.list.useQuery({ accountId });
  const [createOpen, setCreateOpen] = useState(false);
  const isMobile = useIsMobile();

  const totalReserved = savings.reduce((sum, s) => sum + s.balance, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="text-base">{t("card.title")}</CardTitle>
          <CardDescription>{t("card.description")}</CardDescription>
        </div>
        {!accountArchived && (
          <Button
            size={isMobile ? "icon" : "sm"}
            variant={isMobile ? "ghost" : "outline"}
            onClick={() => setCreateOpen(true)}
            aria-label={t("card.addButton")}
            className={isMobile ? "-mt-2 -mr-2 shrink-0" : "shrink-0"}
          >
            <Plus />
            {!isMobile && <span>{t("card.addButton")}</span>}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {savings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Target className="text-muted-foreground h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t("card.empty")}</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {savings.map((s) => (
                <SavingsRow key={s.id} accountId={accountId} savings={s} />
              ))}
            </div>
            {totalReserved > 0 && (
              <div className="border-border text-muted-foreground mt-4 flex items-center justify-between border-t pt-3 text-sm">
                <span>{t("card.totalReserved")}</span>
                <span className="text-foreground font-medium">
                  {formatAmount(totalReserved)}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
      <SavingsDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accountId={accountId}
      />
    </Card>
  );
}
