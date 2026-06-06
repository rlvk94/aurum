"use client";

import { useTranslations } from "next-intl";
import { Button } from "~/app/_components/button";
import { Checkbox } from "~/app/_components/checkbox";
import { Label } from "~/app/_components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/_components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/app/_components/table";
import type {
  ColumnMapping,
  CsvDelimiter,
  CsvEncoding,
  DateFormat,
  MappingValidationError,
  NumberFormat,
  ParseDiagnostics,
} from "./csv-parsers";

const ENCODINGS: CsvEncoding[] = ["utf-8", "iso-8859-1", "windows-1252"];
const DELIMITERS: { value: CsvDelimiter; labelKey: string }[] = [
  { value: ";", labelKey: "delimSemicolon" },
  { value: ",", labelKey: "delimComma" },
  { value: "\t", labelKey: "delimTab" },
  { value: "|", labelKey: "delimPipe" },
];
const DATE_FORMATS: DateFormat[] = [
  "yyyy-MM-dd",
  "dd-MM-yyyy",
  "dd/MM/yyyy",
  "MM/dd/yyyy",
  "yyyy/MM/dd",
  "dd.MM.yyyy",
  "yyyy.MM.dd",
];
const NUMBER_FORMATS: NumberFormat[] = ["comma-decimal", "dot-decimal"];

const NONE_VALUE = "__none__";

type FieldKey =
  | "date"
  | "description"
  | "amount"
  | "debit"
  | "credit"
  | "exportAccount"
  | "counterAccount"
  | "note"
  | "balance";

export function CsvImportMappingStep({
  table,
  mapping,
  onChange,
  onConfirm,
  onBack,
  errors,
  diagnostics,
}: {
  table: string[][];
  mapping: ColumnMapping;
  onChange: (next: ColumnMapping) => void;
  onConfirm: () => void;
  onBack: () => void;
  errors: MappingValidationError[];
  diagnostics?: ParseDiagnostics | null;
}) {
  const t = useTranslations("transactions");

  const headerRow = mapping.hasHeader ? (table[0] ?? []) : [];
  const dataPreview = (mapping.hasHeader ? table.slice(1) : table).slice(0, 5);
  const columnCount = Math.max(
    headerRow.length,
    ...dataPreview.map((r) => r.length),
    0,
  );

  const columnLabel = (idx: number) => {
    const header = headerRow[idx]?.trim();
    if (header) return header;
    return t("mappingColumnFallback", { index: idx + 1 });
  };

  const columnSelect = (
    field: FieldKey,
    value: number | undefined,
    optional: boolean,
  ) => {
    const handle = (raw: string) => {
      const next = raw === NONE_VALUE ? undefined : Number(raw);
      onChange(applyFieldChange(mapping, field, next));
    };
    return (
      <Select
        value={value === undefined ? NONE_VALUE : String(value)}
        onValueChange={handle}
      >
        <SelectTrigger>
          <SelectValue placeholder={t("mappingColumnPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {optional && (
            <SelectItem value={NONE_VALUE}>
              {t("mappingColumnNone")}
            </SelectItem>
          )}
          {Array.from({ length: columnCount }, (_, i) => (
            <SelectItem key={i} value={String(i)}>
              {columnLabel(i)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-foreground text-sm font-medium">
          {t("mappingStepTitle")}
        </p>
        <p className="text-muted-foreground text-xs">
          {t("mappingStepDescription")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t("mappingEncoding")}>
          <Select
            value={mapping.encoding}
            onValueChange={(v) =>
              onChange({ ...mapping, encoding: v as CsvEncoding })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENCODINGS.map((enc) => (
                <SelectItem key={enc} value={enc}>
                  {enc.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t("mappingDelimiter")}>
          <Select
            value={mapping.delimiter}
            onValueChange={(v) =>
              onChange({ ...mapping, delimiter: v as CsvDelimiter })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DELIMITERS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {t(d.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t("mappingHasHeader")}>
          <label className="flex h-10 items-center gap-2">
            <Checkbox
              checked={mapping.hasHeader}
              onCheckedChange={(checked) =>
                onChange({ ...mapping, hasHeader: checked === true })
              }
            />
            <span className="text-sm">{t("mappingHasHeaderHint")}</span>
          </label>
        </Field>
      </div>

      {dataPreview.length > 0 && (
        <div className="border-border overflow-x-auto rounded-lg border">
          <Table>
            {mapping.hasHeader && (
              <TableHeader>
                <TableRow>
                  {Array.from({ length: columnCount }, (_, i) => (
                    <TableHead key={i} className="whitespace-nowrap text-xs">
                      {columnLabel(i)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
            )}
            <TableBody>
              {dataPreview.map((row, i) => (
                <TableRow key={i}>
                  {Array.from({ length: columnCount }, (_, c) => (
                    <TableCell
                      key={c}
                      className="max-w-[12rem] truncate text-xs"
                      title={row[c] ?? ""}
                    >
                      {row[c] ?? ""}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("mappingFieldDate")}>
          {columnSelect("date", mapping.dateColumn, false)}
        </Field>
        <Field label={t("mappingDateFormat")}>
          <Select
            value={mapping.dateFormat}
            onValueChange={(v) =>
              onChange({ ...mapping, dateFormat: v as DateFormat })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t("mappingFieldDescription")}>
          {columnSelect("description", mapping.descriptionColumn, false)}
        </Field>
        <Field label={t("mappingFieldExportAccount")}>
          {columnSelect("exportAccount", mapping.exportAccountColumn, false)}
        </Field>

        <Field label={t("mappingAmountMode")}>
          <Select
            value={mapping.amountMode}
            onValueChange={(v) =>
              onChange({
                ...mapping,
                amountMode: v as "signed" | "split",
                amountColumn:
                  v === "signed" ? mapping.amountColumn : undefined,
                debitColumn: v === "split" ? mapping.debitColumn : undefined,
                creditColumn: v === "split" ? mapping.creditColumn : undefined,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="signed">
                {t("mappingAmountModeSigned")}
              </SelectItem>
              <SelectItem value="split">
                {t("mappingAmountModeSplit")}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("mappingNumberFormat")}>
          <Select
            value={mapping.numberFormat}
            onValueChange={(v) =>
              onChange({ ...mapping, numberFormat: v as NumberFormat })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NUMBER_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>
                  {t(`mappingNumberFormat_${f}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {mapping.amountMode === "signed" ? (
          <Field label={t("mappingFieldAmount")}>
            {columnSelect("amount", mapping.amountColumn, false)}
          </Field>
        ) : (
          <>
            <Field label={t("mappingFieldDebit")}>
              {columnSelect("debit", mapping.debitColumn, false)}
            </Field>
            <Field label={t("mappingFieldCredit")}>
              {columnSelect("credit", mapping.creditColumn, false)}
            </Field>
          </>
        )}

        <Field label={t("mappingFieldCounterAccount")}>
          {columnSelect("counterAccount", mapping.counterAccountColumn, true)}
        </Field>
        <Field label={t("mappingFieldNote")}>
          {columnSelect("note", mapping.noteColumn, true)}
        </Field>
        <Field label={t("mappingFieldBalance")}>
          {columnSelect("balance", mapping.balanceColumn, true)}
        </Field>
      </div>

      {errors.length > 0 && (
        <ul className="text-destructive space-y-1 text-sm">
          {errors.map((err) => (
            <li key={err}>{t(`mappingValidation_${err}`)}</li>
          ))}
        </ul>
      )}

      {diagnostics?.produced === 0 && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive space-y-1 rounded-lg border p-3 text-sm">
          <p className="font-medium">
            {t("mappingDiagnosticsNoneProduced", {
              total: diagnostics.totalRows,
            })}
          </p>
          <ul className="ml-4 list-disc space-y-0.5 text-xs">
            {diagnostics.droppedInvalidDate > 0 && (
              <li>
                {t("mappingDiagnosticsBadDate", {
                  count: diagnostics.droppedInvalidDate,
                  sample: diagnostics.sampleInvalidDate ?? "—",
                  format: mapping.dateFormat,
                })}
              </li>
            )}
            {diagnostics.droppedInvalidAmount > 0 && (
              <li>
                {t("mappingDiagnosticsBadAmount", {
                  count: diagnostics.droppedInvalidAmount,
                  sample: diagnostics.sampleInvalidAmount ?? "—",
                  format: t(`mappingNumberFormat_${mapping.numberFormat}`),
                })}
              </li>
            )}
            {diagnostics.droppedZeroAmount > 0 && (
              <li>
                {t("mappingDiagnosticsZeroAmount", {
                  count: diagnostics.droppedZeroAmount,
                })}
              </li>
            )}
          </ul>
        </div>
      )}

      {diagnostics &&
        diagnostics.produced > 0 &&
        (diagnostics.droppedInvalidDate > 0 ||
          diagnostics.droppedInvalidAmount > 0) && (
          <p className="text-warning text-xs">
            {t("mappingDiagnosticsPartial", {
              produced: diagnostics.produced,
              total: diagnostics.totalRows,
            })}
          </p>
        )}

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={onBack}>
          {t("mappingBack")}
        </Button>
        <Button onClick={onConfirm} disabled={errors.length > 0}>
          {t("mappingNext")}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function applyFieldChange(
  mapping: ColumnMapping,
  field: FieldKey,
  value: number | undefined,
): ColumnMapping {
  switch (field) {
    case "date":
      return { ...mapping, dateColumn: value ?? 0 };
    case "description":
      return { ...mapping, descriptionColumn: value ?? 0 };
    case "amount":
      return { ...mapping, amountColumn: value };
    case "debit":
      return { ...mapping, debitColumn: value };
    case "credit":
      return { ...mapping, creditColumn: value };
    case "exportAccount":
      return { ...mapping, exportAccountColumn: value ?? 0 };
    case "counterAccount":
      return { ...mapping, counterAccountColumn: value };
    case "note":
      return { ...mapping, noteColumn: value };
    case "balance":
      return { ...mapping, balanceColumn: value };
  }
}
