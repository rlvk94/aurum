"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { api } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { Label } from "~/app/_components/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "~/app/_components/input-otp";

type Step = "email" | "code";

function EmailChangeForm({
  pendingEmail,
  onClose,
}: {
  pendingEmail: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("settings.profile.emailChangeDialog");
  const tCommon = useTranslations("common");
  const utils = api.useUtils();

  const [step, setStep] = useState<Step>(pendingEmail ? "code" : "email");
  const [email, setEmail] = useState(pendingEmail ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const requestChange = api.user.requestEmailChange.useMutation({
    onSuccess: () => {
      void utils.user.me.invalidate();
      setStep("code");
    },
    onError: (e) => setError(e.message),
  });

  const confirmChange = api.user.confirmEmailChange.useMutation({
    onSuccess: () => {
      void utils.user.me.invalidate();
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>
          {step === "email"
            ? t("step1Description")
            : t("step2Description", { email })}
        </DialogDescription>
      </DialogHeader>

      {step === "email" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            requestChange.mutate({ newEmail: email.trim() });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="new-email">{t("newEmailLabel")}</Label>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={requestChange.isPending}>
              {requestChange.isPending ? tCommon("loading") : t("sendCode")}
            </Button>
          </DialogFooter>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            confirmChange.mutate({ code });
          }}
          className="space-y-4"
        >
          <div className="flex flex-col items-center gap-3">
            <Label>{t("codeLabel")}</Label>
            <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={code.length !== 6 || confirmChange.isPending}
            >
              {confirmChange.isPending ? tCommon("loading") : t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  );
}

export function EmailChangeDialog({
  open,
  onOpenChange,
  pendingEmail,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pendingEmail: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <EmailChangeForm
            key={pendingEmail ?? "new"}
            pendingEmail={pendingEmail}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
