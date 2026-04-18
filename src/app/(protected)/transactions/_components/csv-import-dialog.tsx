"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { format, parse } from "date-fns";
import { da, enUS } from "date-fns/locale";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import {
  detectParser,
  normalizeAccountNumber,
  resolveRows,
  type CsvParser,
  type ParsedTransaction,
} from "./csv-parsers";

type Account = RouterOutputs["financialAccount"]["list"][number];

type Parsed = {
  parser: CsvParser;
  rows: ParsedTransaction[];
};

export function CsvImportDialog({
  open,
  onOpenChange,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
}) {
  const t = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dateLocale = locale === "da" ? da : enUS;
  const utils = api.useUtils();

  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const bulkImport = api.transaction.bulkImport.useMutation({
    onSuccess: () => {
      void utils.transaction.list.invalidate();
      void utils.financialAccount.summary.invalidate();
      reset();
      onOpenChange(false);
    },
  });

  const accountByCanonical = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts) {
      map.set(normalizeAccountNumber(a.identifier), a.id);
    }
    return map;
  }, [accounts]);

  const reset = () => {
    setParseError(null);
    setParsed(null);
    setIsParsing(false);
  };

  const handleFile = async (file: File) => {
    reset();
    setIsParsing(true);
    try {
      const parser = await detectParser(file);
      const rows = await parser.parse(file);

      if (rows.length === 0) {
        setParseError(t("importUnsupportedFormat"));
        return;
      }

      setParsed({ parser, rows });
    } catch (e) {
      setParseError(
        e instanceof Error ? e.message : t("importUnsupportedFormat"),
      );
    } finally {
      setIsParsing(false);
    }
  };

  const resolved = useMemo(() => {
    if (!parsed) return null;
    return resolveRows(parsed.rows, accountByCanonical);
  }, [parsed, accountByCanonical]);

  const transferCount = useMemo(
    () => resolved?.matched.filter((r) => r.type === "transfer").length ?? 0,
    [resolved],
  );

  const handleImport = () => {
    if (!resolved || resolved.matched.length === 0) return;
    bulkImport.mutate({
      transactions: resolved.matched,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("importDialogTitle")}</DialogTitle>
          <DialogDescription>{t("importDialogDescription")}</DialogDescription>
        </DialogHeader>

        {!parsed && !isParsing && (
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-10 text-sm hover:border-primary/40 transition-colors">
            <Upload className="size-6 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {t("importSelectFile")}
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
        )}

        {isParsing && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            {tCommon("loading")}
          </div>
        )}

        {parseError && <p className="text-sm text-destructive">{parseError}</p>}

        {parsed && resolved && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm">
              <CheckCircle2 className="size-4 shrink-0 text-income" />
              <div className="space-y-0.5">
                <p className="font-medium text-foreground">
                  {t("importFileReady")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {parsed.parser.label}
                </p>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">
                {t("importPreviewTitle", { count: resolved.matched.length })}
              </p>
              <p className="text-muted-foreground">
                {t("importMatchedAccounts", {
                  count: resolved.matchedAccountIds.size,
                })}
              </p>
              {transferCount > 0 && (
                <p className="text-muted-foreground">
                  {t("importPreviewTransfers", { count: transferCount })}
                </p>
              )}
              {resolved.mirroredSkipped > 0 && (
                <p className="text-muted-foreground">
                  {t("importMirrorSkipped", {
                    count: resolved.mirroredSkipped,
                  })}
                </p>
              )}
              {resolved.skipped > 0 && (
                <p className="text-warning">
                  {t("importSkippedRows", { count: resolved.skipped })}
                </p>
              )}
            </div>

            {resolved.matched.length > 0 && (
              <div className="max-h-60 space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-2 text-xs">
                {resolved.matched.slice(0, 50).map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 py-1"
                  >
                    <span className="whitespace-nowrap text-muted-foreground">
                      {format(
                        parse(row.date, "yyyy-MM-dd", new Date()),
                        "d. MMM yyyy",
                        { locale: dateLocale },
                      )}
                    </span>
                    <span className="flex-1 truncate">{row.description}</span>
                    <span
                      className={
                        row.type === "expense"
                          ? "text-expense"
                          : row.type === "income"
                            ? "text-income"
                            : "text-savings"
                      }
                    >
                      {row.type === "expense" && "-"}
                      {row.type === "income" && "+"}
                      {(row.amount / 100).toLocaleString("da-DK", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      kr.
                    </span>
                  </div>
                ))}
                {resolved.matched.length > 50 && (
                  <p className="pt-2 text-center text-muted-foreground">
                    {t("importPreviewMore", {
                      count: resolved.matched.length - 50,
                    })}
                  </p>
                )}
              </div>
            )}

            {bulkImport.error && (
              <p className="text-sm text-destructive">{tCommon("error")}</p>
            )}

            {bulkImport.data && (
              <p className="text-sm text-income">
                {t("importSuccess", bulkImport.data)}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {parsed && resolved && (
            <Button
              onClick={handleImport}
              disabled={resolved.matched.length === 0 || bulkImport.isPending}
            >
              {bulkImport.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  {tCommon("loading")}
                </>
              ) : (
                t("importConfirm")
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
