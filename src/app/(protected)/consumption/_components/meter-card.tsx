"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import { type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/app/_components/badge";
import { Button } from "~/app/_components/button";
import { Card, CardContent, CardHeader } from "~/app/_components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/app/_components/dropdown-menu";
import { parseMonthsShort } from "~/app/(protected)/budgets/annual/_lib/budget-format";
import { cn } from "~/app/_lib/utils";
import {
  formatChangePct,
  formatDelta,
  formatQuantity,
  formatReadingDate,
  formatUnit,
  perDayDecimals,
  percentChange,
} from "../_lib/format";
import { MeterIcon, meterTint } from "../_lib/meter-icons";

type MeterListItem = RouterOutputs["consumption"]["listMeters"][number];

export function MeterCard({
  item,
  onEdit,
  onArchiveToggle,
  onDelete,
}: {
  item: MeterListItem;
  onEdit: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("consumption");
  const tBudgets = useTranslations("budgets");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const months = parseMonthsShort(tBudgets("monthsShort"));

  const { latestReading, lastInterval, lastCompleteMonth } = item;
  const changePct = lastCompleteMonth
    ? percentChange(
        lastCompleteMonth.consumption,
        lastCompleteMonth.previousYearConsumption,
      )
    : null;

  return (
    <Card className={item.archived ? "opacity-60" : ""}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="bg-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <MeterIcon
              kind={item.kind}
              className={cn("h-5 w-5", meterTint(item.kind))}
            />
          </div>
          <div className="min-w-0">
            <Link
              href={`/consumption/${item.id}`}
              className="font-display hover:text-primary block truncate text-lg leading-tight"
            >
              {item.name}
            </Link>
            <p className="text-muted-foreground truncate text-xs">
              {t(`kinds.${item.kind as "electricity"}`)}
              {item.unit ? ` · ${formatUnit(item.unit)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {item.isOverdue && !item.archived && (
            <Badge
              variant="outline"
              className="border-warning/40 text-warning whitespace-nowrap"
            >
              {t("overdue")}
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={tCommon("more")}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil />
                {tCommon("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchiveToggle}>
                {item.archived ? <ArchiveRestore /> : <Archive />}
                {item.archived ? t("unarchive") : t("archive")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 />
                {t("deleteMeter")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="text-muted-foreground text-xs">{t("latestReading")}</p>
          {latestReading ? (
            <>
              <p className="font-display text-2xl leading-tight tabular-nums">
                {formatQuantity(latestReading.value, item.decimals, item.unit)}
              </p>
              <p className="text-muted-foreground text-xs">
                {formatReadingDate(latestReading.date, locale)}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("noReadingsYet")}
            </p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-xs">
          <Stat
            label={t("lastInterval")}
            value={
              lastInterval
                ? `${formatDelta(lastInterval.consumption, item.decimals, item.unit)} · ${t("days", { count: lastInterval.days })}`
                : "—"
            }
          />
          <Stat
            label={t("perDay")}
            value={
              lastInterval?.perDay !== null &&
              lastInterval?.perDay !== undefined
                ? formatQuantity(
                    Math.round(lastInterval.perDay),
                    perDayDecimals(item.decimals),
                    item.unit,
                  )
                : "—"
            }
          />
          <Stat
            label={t("lastCompleteMonth")}
            value={
              lastCompleteMonth
                ? `${months[lastCompleteMonth.month - 1]} ${lastCompleteMonth.year}: ${formatQuantity(lastCompleteMonth.consumption, item.decimals, item.unit)}`
                : "—"
            }
          />
          <Stat
            label={t("vsLastYear")}
            value={formatChangePct(changePct)}
            tone={
              changePct === null
                ? "default"
                : changePct < 0
                  ? "income"
                  : changePct > 0
                    ? "expense"
                    : "default"
            }
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "income" | "expense";
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate font-medium tabular-nums",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
