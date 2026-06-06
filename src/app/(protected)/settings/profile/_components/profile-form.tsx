"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UserRound } from "lucide-react";

import { api } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { Label } from "~/app/_components/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import { EmailChangeDialog } from "./email-change-dialog";

function Avatar({ src, name }: { src: string | null; name: string }) {
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  if (src) {
    return (
      <div className="flex h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- external avatar URL (e.g. Google), tiny 64px image; next/image remotePatterns config not warranted */}
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-medium text-accent-foreground">
      {initials || <UserRound className="size-6" />}
    </div>
  );
}

export function ProfileForm() {
  const t = useTranslations("settings.profile");
  const tSettings = useTranslations("settings");
  const tCommon = useTranslations("common");

  const utils = api.useUtils();
  const { data: me } = api.user.me.useQuery();

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [imageDraft, setImageDraft] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const name = nameDraft ?? me?.name ?? "";
  const image = imageDraft ?? me?.image ?? "";

  const updateProfile = api.user.updateProfile.useMutation({
    onSuccess: () => {
      void utils.user.me.invalidate();
      setNameDraft(null);
      setImageDraft(null);
      setSavedAt(Date.now());
    },
  });

  const cancelEmailChange = api.user.cancelEmailChange.useMutation({
    onSuccess: () => {
      void utils.user.me.invalidate();
    },
  });

  const nameChanged = nameDraft !== null && nameDraft.trim() !== me?.name;
  const imageChanged =
    imageDraft !== null && (imageDraft || null) !== (me?.image ?? null);
  const dirty = nameChanged || imageChanged;
  const canSave = dirty && name.trim().length > 0 && !updateProfile.isPending;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("avatarLabel")}</CardTitle>
          <CardDescription>{t("avatarHelp")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar src={image ? image : null} name={name} />
            <div className="flex-1 space-y-2">
              <Input
                type="url"
                placeholder={t("avatarUrlPlaceholder")}
                value={image}
                onChange={(e) => setImageDraft(e.target.value)}
              />
              {image && (
                <button
                  type="button"
                  onClick={() => setImageDraft("")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("avatarClear")}
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("nameLabel")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="name" className="sr-only">
            {t("nameLabel")}
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setNameDraft(e.target.value)}
            maxLength={100}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("emailLabel")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm">{me?.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
            >
              {t("changeEmail")}
            </Button>
          </div>
          {me?.pendingEmail && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-warning/60 bg-warning/5 p-3 text-sm">
              <span className="text-muted-foreground">
                {t("pendingEmailNotice", { email: me.pendingEmail })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                >
                  {t("resume")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelEmailChange.mutate()}
                  disabled={cancelEmailChange.isPending}
                >
                  {t("cancelEmailChange")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {savedAt && !dirty && (
          <span className="text-sm text-muted-foreground">
            {tSettings("saved")}
          </span>
        )}
        <Button
          disabled={!canSave}
          onClick={() =>
            updateProfile.mutate({
              name: nameChanged ? name.trim() : undefined,
              image: imageChanged ? image || null : undefined,
            })
          }
        >
          {updateProfile.isPending ? tCommon("loading") : t("saveChanges")}
        </Button>
      </div>

      <EmailChangeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pendingEmail={me?.pendingEmail ?? null}
      />
    </div>
  );
}
