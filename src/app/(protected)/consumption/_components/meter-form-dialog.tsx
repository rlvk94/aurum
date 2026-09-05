"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";

import { api } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/app/_components/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/app/_components/select";
import { cn } from "~/app/_lib/utils";
import {
  KIND_DEFAULTS,
  METER_KINDS,
  METER_MAX_DECIMALS,
  METER_UNIT_MAX_LENGTH,
  METER_UNIT_PRESETS,
  type MeterKind,
} from "~/lib/consumption-kinds";
import { formatQuantity, formatUnit } from "../_lib/format";
import { MeterIcon } from "../_lib/meter-icons";

type MeterInput = {
  id: string;
  name: string;
  kind: string;
  unit: string;
  decimals: number;
};

const CUSTOM = "__custom";
const DECIMAL_OPTIONS = Array.from(
  { length: METER_MAX_DECIMALS + 1 },
  (_, i) => i,
);

function isPreset(unit: string): boolean {
  return (METER_UNIT_PRESETS as readonly string[]).includes(unit);
}

export function MeterFormDialog({
  open,
  onOpenChange,
  meter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meter?: MeterInput;
}) {
  const t = useTranslations("consumption");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const utils = api.useUtils();
  const isEdit = Boolean(meter);

  const [name, setName] = useState(meter?.name ?? "");
  const [kind, setKind] = useState<MeterKind>(
    (meter?.kind as MeterKind | undefined) ?? "electricity",
  );
  const [unitPreset, setUnitPreset] = useState<string>(() => {
    const u = meter?.unit ?? KIND_DEFAULTS.electricity.unit;
    return isPreset(u) ? u : CUSTOM;
  });
  const [customUnit, setCustomUnit] = useState(() =>
    meter && !isPreset(meter.unit) ? meter.unit : "",
  );
  const [decimals, setDecimals] = useState(
    meter?.decimals ?? KIND_DEFAULTS.electricity.decimals,
  );
  const [errors, setErrors] = useState<{ name?: string; unit?: string }>({});

  const unit = useMemo(
    () => (unitPreset === CUSTOM ? formatUnit(customUnit) : unitPreset),
    [unitPreset, customUnit],
  );

  const onSuccess = () => {
    onOpenChange(false);
    void utils.consumption.listMeters.invalidate();
    void utils.consumption.summary.invalidate();
    if (meter) void utils.consumption.getMeter.invalidate({ id: meter.id });
  };
  const create = api.consumption.createMeter.useMutation({
    onSuccess: (_, vars) => {
      posthog.capture("consumption_meter_created", { kind: vars.kind });
      onSuccess();
    },
  });
  const update = api.consumption.updateMeter.useMutation({ onSuccess });
  const mutation = isEdit ? update : create;

  const applyKind = (next: MeterKind) => {
    setKind(next);
    if (isEdit) return;
    const d = KIND_DEFAULTS[next];
    setUnitPreset(d.unit && isPreset(d.unit) ? d.unit : CUSTOM);
    setCustomUnit(d.unit && !isPreset(d.unit) ? d.unit : "");
    setDecimals(d.decimals);
  };

  const submit = () => {
    const nextErrors: typeof errors = {};
    const trimmed = name.trim();
    if (!trimmed) nextErrors.name = tValidation("required");
    if (unit.length > METER_UNIT_MAX_LENGTH)
      nextErrors.unit = tValidation("invalid");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (isEdit && meter) {
      update.mutate({ id: meter.id, name: trimmed, kind, unit, decimals });
    } else {
      create.mutate({ name: trimmed, kind, unit, decimals });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("form.editTitle") : t("form.createTitle")}
          </DialogTitle>
          <DialogDescription>{t("form.description")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="meter-name">{t("form.name")}</FieldLabel>
              <Input
                id="meter-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("form.namePlaceholder")}
                aria-invalid={Boolean(errors.name)}
                autoFocus={!isEdit}
                maxLength={60}
              />
              {errors.name && (
                <FieldError errors={[{ message: errors.name }]} />
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="meter-kind">{t("form.kind")}</FieldLabel>
              <Select
                value={kind}
                onValueChange={(v) => applyKind(v as MeterKind)}
              >
                <SelectTrigger id="meter-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METER_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <MeterIcon kind={k} className="h-4 w-4" />
                        {t(`kinds.${k}`)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field data-invalid={Boolean(errors.unit)}>
              <FieldLabel htmlFor="meter-unit">{t("form.unit")}</FieldLabel>
              <div className="flex gap-2">
                <Select value={unitPreset} onValueChange={setUnitPreset}>
                  <SelectTrigger id="meter-unit" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METER_UNIT_PRESETS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM}>
                      {t("form.unitCustom")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {unitPreset === CUSTOM && (
                  <Input
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    placeholder={t("form.customUnitPlaceholder")}
                    maxLength={METER_UNIT_MAX_LENGTH}
                    aria-invalid={Boolean(errors.unit)}
                    className="flex-1"
                  />
                )}
              </div>
              {errors.unit && (
                <FieldError errors={[{ message: errors.unit }]} />
              )}
              {isEdit && (
                <FieldDescription>{t("form.unitChangeHint")}</FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel>{t("form.decimals")}</FieldLabel>
              <div className="flex gap-2">
                {DECIMAL_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDecimals(d)}
                    aria-pressed={decimals === d}
                    className={cn(
                      "border-border h-9 w-9 rounded-md border text-sm tabular-nums transition-colors",
                      decimals === d
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <FieldDescription>
                {t("form.decimalsExample", {
                  example: formatQuantity(1_234_567, decimals, unit),
                })}
              </FieldDescription>
            </Field>
          </FieldGroup>

          {mutation.error && (
            <p className="text-destructive mt-4 text-sm">{tCommon("error")}</p>
          )}

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? tCommon("loading")
                : isEdit
                  ? tCommon("save")
                  : tCommon("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
