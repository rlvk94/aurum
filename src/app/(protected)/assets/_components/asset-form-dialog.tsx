"use client";

import { useTranslations } from "next-intl";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Home, Car, TrendingUp, Gem, Package } from "lucide-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import {
  Field,
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
import { cn } from "~/app/_lib/utils";

export const assetTypeIcons = {
  property: Home,
  vehicle: Car,
  investment: TrendingUp,
  collectible: Gem,
  other: Package,
} as const;

export type AssetType = keyof typeof assetTypeIcons;

const assetTypes = Object.keys(assetTypeIcons) as AssetType[];

type Asset = RouterOutputs["asset"]["list"][number];

const assetFormSchema = z.object({
  name: z.string().min(1, "Required").max(100),
  type: z.enum(["property", "vehicle", "investment", "collectible", "other"]),
  value: z.string(),
  note: z.string(),
});

export function AssetFormDialog({
  open,
  onOpenChange,
  asset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset;
}) {
  const t = useTranslations("assets");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();
  const isEdit = !!asset;

  const createAsset = api.asset.create.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      form.reset();
      void utils.asset.list.invalidate();
      void utils.asset.summary.invalidate();
    },
  });

  const updateAsset = api.asset.update.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      void utils.asset.list.invalidate();
      void utils.asset.summary.invalidate();
    },
  });

  const form = useForm({
    defaultValues: {
      name: asset?.name ?? "",
      type: (asset?.type as AssetType) ?? "property",
      value: asset ? String(asset.value / 100) : "",
      note: asset?.note ?? "",
    },
    validators: {
      onSubmit: assetFormSchema,
    },
    onSubmit: async ({ value }) => {
      const valueCents = Math.round(parseFloat(value.value || "0") * 100);
      const trimmedNote = value.note.trim();
      if (isEdit) {
        updateAsset.mutate({
          id: asset.id,
          name: value.name.trim(),
          type: value.type,
          value: valueCents,
          note: trimmedNote || null,
        });
      } else {
        createAsset.mutate({
          name: value.name.trim(),
          type: value.type,
          value: valueCents,
          note: trimmedNote || undefined,
        });
      }
    },
  });

  const mutation = isEdit ? updateAsset : createAsset;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) form.reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editAsset") : t("addAsset")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("editAssetDescription") : t("addAssetDescription")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field
              name="name"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      {t("assetName")}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder={t("assetNamePlaceholder")}
                      autoFocus
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            />

            <form.Field
              name="type"
              children={(field) => (
                <Field>
                  <FieldLabel>{t("assetType")}</FieldLabel>
                  <div className="grid grid-cols-5 gap-2">
                    {assetTypes.map((type) => {
                      const Icon = assetTypeIcons[type];
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => field.handleChange(type)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-all",
                            field.state.value === type
                              ? "border-primary bg-accent text-accent-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-primary/30",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {t(`types.${type}`)}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}
            />

            <form.Field
              name="value"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t("currentValue")}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />

            <form.Field
              name="note"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {t("noteLabel")}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t("notePlaceholder")}
                  />
                </Field>
              )}
            />
          </FieldGroup>

          {mutation.error && (
            <p className="mt-4 text-sm text-destructive">{tCommon("error")}</p>
          )}

          <DialogFooter className="mt-6">
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
