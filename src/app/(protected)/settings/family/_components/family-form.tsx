"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { api } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { Label } from "~/app/_components/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";

export function FamilyForm() {
  const t = useTranslations("settings.family");
  const tSettings = useTranslations("settings");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();

  const { data: current } = api.family.current.useQuery();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const name = nameDraft ?? current?.name ?? "";

  const updateFamily = api.family.update.useMutation({
    onSuccess: () => {
      void utils.family.current.invalidate();
      void utils.family.list.invalidate();
      setNameDraft(null);
      setSavedAt(Date.now());
    },
  });

  const isOwner = current?.role === "owner";
  const dirty = nameDraft !== null && nameDraft.trim() !== current?.name;
  const canSave = !!isOwner && dirty && name.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      {!isOwner && (
        <p className="rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
          {t("readOnlyNotice")}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("nameLabel")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="family-name" className="sr-only">
            {t("nameLabel")}
          </Label>
          <Input
            id="family-name"
            value={name}
            onChange={(e) => setNameDraft(e.target.value)}
            disabled={!isOwner}
            maxLength={100}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {savedAt && !dirty && (
          <span className="text-sm text-muted-foreground">
            {tSettings("saved")}
          </span>
        )}
        <Button
          disabled={!canSave || updateFamily.isPending}
          onClick={() => updateFamily.mutate({ name: name.trim() })}
        >
          {updateFamily.isPending ? tCommon("loading") : t("saveChanges")}
        </Button>
      </div>
    </div>
  );
}
