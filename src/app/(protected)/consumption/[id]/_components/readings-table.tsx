"use client";

import { useLocale, useTranslations } from "next-intl";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/app/_components/badge";
import { Button } from "~/app/_components/button";
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
import { cn } from "~/app/_lib/utils";
import {
  formatDelta,
  formatQuantity,
  formatReadingDate,
  perDayDecimals,
} from "../../_lib/format";

type Reading = RouterOutputs["consumption"]["getMeter"]["readings"][number];

export function ReadingsTable({
  rows,
  decimals,
  unit,
  onEdit,
  onDelete,
}: {
  rows: Reading[];
  decimals: number;
  unit: string;
  onEdit: (reading: Reading) => void;
  onDelete: (reading: Reading) => void;
}) {
  const t = useTranslations("consumption");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        {t("readings.empty")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tCommon("date")}</TableHead>
            <TableHead className="text-right">
              {t("readings.columns.value")}
            </TableHead>
            <TableHead className="text-right">
              {t("readings.columns.delta")}
            </TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              {t("readings.columns.days")}
            </TableHead>
            <TableHead className="hidden text-right md:table-cell">
              {t("readings.columns.perDay")}
            </TableHead>
            <TableHead className="hidden md:table-cell">
              {tCommon("note")}
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="group">
              <TableCell className="whitespace-nowrap">
                {formatReadingDate(r.date, locale)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm whitespace-nowrap tabular-nums">
                {formatQuantity(r.value, decimals, unit)}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap tabular-nums">
                {r.isMeterReset ? (
                  <Badge variant="secondary">{t("resetBadge")}</Badge>
                ) : r.consumption === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span className={cn(r.consumption < 0 && "text-expense")}>
                    {formatDelta(r.consumption, decimals, unit)}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground hidden text-right tabular-nums sm:table-cell">
                {r.days ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground hidden text-right whitespace-nowrap tabular-nums md:table-cell">
                {r.perDay === null
                  ? "—"
                  : formatQuantity(
                      Math.round(r.perDay),
                      perDayDecimals(decimals),
                      unit,
                    )}
              </TableCell>
              <TableCell className="text-muted-foreground hidden max-w-[16rem] truncate md:table-cell">
                {r.note ?? ""}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-60 group-hover:opacity-100"
                      aria-label={tCommon("more")}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(r)}>
                      <Pencil />
                      {tCommon("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDelete(r)}
                    >
                      <Trash2 />
                      {tCommon("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
