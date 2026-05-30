"use client";

import { useEffect, useMemo, useState } from "react";
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
import posthog from "posthog-js";
import {
  buildDefaultMapping,
  decodeFile,
  detectDelimiter,
  detectParser,
  normalizeAccountNumber,
  parseWithMapping,
  resolveRows,
  splitRows,
  validateMapping,
  type ColumnMapping,
  type CsvParser,
  type ParsedTransaction,
  type ParseDiagnostics,
} from "./csv-parsers";
import { CsvImportMappingStep } from "./csv-import-mapping-step";
// Pure, isomorphic helper — import the file directly (not the barrel) to keep
// server-only categorization code out of the client bundle.
import { sanitizeBankText } from "~/server/categorization/sanitize";

type Account = RouterOutputs["financialAccount"]["list"][number];

type Step = "select" | "mapping" | "preview";

type Parsed = {
  source: { kind: "auto"; parser: CsvParser } | { kind: "manual" };
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

  const [step, setStep] = useState<Step>("select");
  const [file, setFile] = useState<File | null>(null);
  const [rawTable, setRawTable] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [mappingDiagnostics, setMappingDiagnostics] =
    useState<ParseDiagnostics | null>(null);

  const bulkImport = api.transaction.bulkImport.useMutation({
    onSuccess: (data) => {
      posthog.capture("csv_import_completed", {
        total_count: data.total,
        inserted_count: data.inserted,
        skipped_count: data.skipped,
        source: parsed?.source.kind ?? "unknown",
      });
      void utils.transaction.list.invalidate();
      void utils.financialAccount.summary.invalidate();
      void utils.financialAccount.list.invalidate();
      void utils.financialAccount.get.invalidate();
      void utils.challenge.list.invalidate();
      void utils.challenge.get.invalidate();
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
    setStep("select");
    setFile(null);
    setRawTable([]);
    setMapping(null);
    setParseError(null);
    setParsed(null);
    setIsParsing(false);
    setMappingDiagnostics(null);
  };

  // Re-decode whenever the user changes encoding or delimiter on the
  // mapping step. Keeping this in an effect avoids the user having to click
  // a refresh button after each switch.
  useEffect(() => {
    if (step !== "mapping" || !file || !mapping) return;
    let cancelled = false;
    void (async () => {
      const text = await decodeFile(file, mapping.encoding);
      const next = splitRows(text, mapping.delimiter);
      if (!cancelled) setRawTable(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [step, file, mapping?.encoding, mapping?.delimiter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = async (picked: File) => {
    reset();
    setIsParsing(true);
    setFile(picked);
    try {
      const parser = await detectParser(picked);
      if (parser) {
        const rows = await parser.parse(picked);
        if (rows.length === 0) {
          setParseError(t("importUnsupportedFormat"));
          return;
        }
        setParsed({ source: { kind: "auto", parser }, rows });
        setStep("preview");
        return;
      }

      // No registered parser matched — fall into the manual mapping flow.
      const text = await decodeFile(picked, "utf-8");
      const firstLine =
        text.split(/\r\n|\n|\r/).find((l) => l.length > 0) ?? "";
      const delimiter = detectDelimiter(firstLine);
      const table = splitRows(text, delimiter);
      if (table.length === 0) {
        setParseError(t("importUnsupportedFormat"));
        return;
      }
      const defaultMapping = buildDefaultMapping(table, {
        encoding: "utf-8",
        delimiter,
      });
      setRawTable(table);
      setMapping(defaultMapping);
      setStep("mapping");
    } catch (e) {
      setParseError(
        e instanceof Error ? e.message : t("importUnsupportedFormat"),
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmMapping = () => {
    if (!mapping) return;
    const errors = validateMapping(mapping);
    if (errors.length > 0) return;
    const { rows, diagnostics } = parseWithMapping(rawTable, mapping);
    setMappingDiagnostics(diagnostics);
    if (rows.length === 0) {
      // Stay on the mapping step so the user can adjust based on the
      // diagnostic block we render below the form.
      return;
    }
    setParsed({ source: { kind: "manual" }, rows });
    setStep("preview");
  };

  const resolved = useMemo(() => {
    if (!parsed) return null;
    return resolveRows(parsed.rows, accountByCanonical);
  }, [parsed, accountByCanonical]);

  const linkedPairCount = useMemo(() => {
    if (!resolved) return 0;
    const groups = new Set<string>();
    for (const row of resolved.matched) {
      if (row.transferGroupId) groups.add(row.transferGroupId);
    }
    return groups.size;
  }, [resolved]);

  const handleImport = () => {
    if (!resolved || resolved.matched.length === 0) return;
    bulkImport.mutate({
      transactions: resolved.matched,
    });
  };

  const mappingErrors = useMemo(
    () => (mapping ? validateMapping(mapping) : []),
    [mapping],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("importDialogTitle")}</DialogTitle>
          <DialogDescription>{t("importDialogDescription")}</DialogDescription>
        </DialogHeader>

        {step === "select" && !isParsing && (
          <label className="border-border bg-card hover:border-primary/40 flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-sm transition-colors">
            <Upload className="text-muted-foreground size-6" />
            <span className="text-foreground font-medium">
              {t("importSelectFile")}
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) void handleFile(picked);
                e.target.value = "";
              }}
            />
          </label>
        )}

        {isParsing && (
          <div className="text-muted-foreground flex items-center justify-center py-10">
            <Loader2 className="mr-2 size-4 animate-spin" />
            {tCommon("loading")}
          </div>
        )}

        {parseError && <p className="text-destructive text-sm">{parseError}</p>}

        {step === "mapping" && mapping && (
          <CsvImportMappingStep
            table={rawTable}
            mapping={mapping}
            onChange={(next) => {
              setMapping(next);
              setMappingDiagnostics(null);
            }}
            onConfirm={handleConfirmMapping}
            onBack={() => {
              setStep("select");
              setFile(null);
              setRawTable([]);
              setMapping(null);
              setMappingDiagnostics(null);
            }}
            errors={mappingErrors}
            diagnostics={mappingDiagnostics}
          />
        )}

        {step === "preview" && parsed && resolved && (
          <div className="space-y-4">
            <div className="border-border bg-card flex items-start gap-2 rounded-lg border p-3 text-sm">
              <CheckCircle2 className="text-income size-4 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-foreground font-medium">
                  {t("importFileReady")}
                </p>
                <p className="text-muted-foreground text-xs">
                  {parsed.source.kind === "auto"
                    ? parsed.source.parser.label
                    : t("importManualMappingLabel")}
                </p>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <p className="text-foreground font-medium">
                {t("importPreviewTitle", { count: resolved.matched.length })}
              </p>
              <p className="text-muted-foreground">
                {t("importMatchedAccounts", {
                  count: resolved.matchedAccountIds.size,
                })}
              </p>
              {linkedPairCount > 0 && (
                <p className="text-muted-foreground">
                  {t("importPreviewLinkedPairs", { count: linkedPairCount })}
                </p>
              )}
              {resolved.skipped > 0 && (
                <p className="text-warning">
                  {t("importSkippedRows", { count: resolved.skipped })}
                </p>
              )}
            </div>

            {resolved.matched.length > 0 && (
              <div className="border-border bg-card max-h-60 space-y-1 overflow-y-auto rounded-lg border p-2 text-xs">
                {resolved.matched.slice(0, 50).map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 py-1"
                  >
                    <span className="text-muted-foreground whitespace-nowrap">
                      {format(
                        parse(row.date, "yyyy-MM-dd", new Date()),
                        "d. MMM yyyy",
                        { locale: dateLocale },
                      )}
                    </span>
                    <span className="flex-1 truncate">
                      {sanitizeBankText(row.description)}
                    </span>
                    <span
                      className={
                        row.type === "expense" ? "text-expense" : "text-income"
                      }
                    >
                      {row.type === "expense" ? "-" : "+"}
                      {(row.amount / 100).toLocaleString("da-DK", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      kr.
                    </span>
                  </div>
                ))}
                {resolved.matched.length > 50 && (
                  <p className="text-muted-foreground pt-2 text-center">
                    {t("importPreviewMore", {
                      count: resolved.matched.length - 50,
                    })}
                  </p>
                )}
              </div>
            )}

            {bulkImport.error && (
              <p className="text-destructive text-sm">{t("importFailed")}</p>
            )}

            {bulkImport.data && (
              <p className="text-income text-sm">
                {t("importSuccess", bulkImport.data)}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "preview" && parsed && resolved && (
            <>
              {parsed.source.kind === "manual" && (
                <Button
                  variant="outline"
                  onClick={() => setStep("mapping")}
                  disabled={bulkImport.isPending}
                >
                  {t("mappingBack")}
                </Button>
              )}
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
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
