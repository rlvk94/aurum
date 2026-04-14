"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "~/app/_lib/auth-client";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";

export default function VerifyPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const { error } = await authClient.signIn.emailOtp({
      email,
      otp: code,
    });

    if (error) {
      setError(t("verifyError"));
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  const handleResend = async () => {
    setError("");
    setResent(false);

    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });

    if (error) {
      setError(t("sendCodeError"));
      return;
    }

    setResent(true);
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="font-display text-2xl">
          {t("verifyTitle")}
        </CardTitle>
        <CardDescription>
          {t("verifyDescription", { email })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="code" className="text-sm font-medium">
              {t("codeLabel")}
            </label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder={t("codePlaceholder")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
              className="text-center text-lg tracking-widest"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {resent && (
            <p className="text-sm text-muted-foreground">{t("codeResent")}</p>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? tCommon("loading") : t("verify")}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleResend}
              className="text-muted-foreground hover:text-foreground"
            >
              {t("resendCode")}
            </button>
            <Link
              href="/sign-in"
              className="text-muted-foreground hover:text-foreground"
            >
              {t("backToSignIn")}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
