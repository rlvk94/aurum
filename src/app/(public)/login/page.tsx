"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { authClient } from "~/app/_lib/auth-client";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "~/app/_components/input-otp";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";

type Step = "email" | "otp";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });

    if (error) {
      setError(t("sendCodeError"));
      setIsLoading(false);
      return;
    }

    posthog.capture("login_otp_sent", { email });
    setIsLoading(false);
    setStep("otp");
  };

  const handleVerify = async (e: React.FormEvent) => {
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

    posthog.identify(email, { email });
    posthog.capture("login_completed", { email });
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

  const handleBackToEmail = () => {
    setStep("email");
    setCode("");
    setError("");
    setResent(false);
  };

  if (step === "otp") {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">
            {t("verifyTitle")}
          </CardTitle>
          <CardDescription>{t("verifyDescription", { email })}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="flex justify-center">
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
              <p className="text-destructive text-center text-sm">{error}</p>
            )}
            {resent && (
              <p className="text-muted-foreground text-center text-sm">
                {t("codeResent")}
              </p>
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
              <button
                type="button"
                onClick={handleBackToEmail}
                className="text-muted-foreground hover:text-foreground"
              >
                {t("backToEmail")}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="font-display text-2xl">
          {t("loginTitle")}
        </CardTitle>
        <CardDescription>{t("loginDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSendCode} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              {t("emailLabel")}
            </label>
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? tCommon("loading") : t("sendCode")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
