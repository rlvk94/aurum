"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  LogOut,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { authClient } from "~/app/_lib/auth-client";
import { api } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { Checkbox } from "~/app/_components/checkbox";
import { TermsContent } from "~/app/_components/terms-content";
import { PlanCard } from "~/app/_components/billing/plan-card";
import { PaymentForm } from "~/app/_components/billing/payment-form";
import { cn } from "~/app/_lib/utils";

type Step = "name" | "language" | "terms" | "theme" | "family" | "plan";
type Theme = "light" | "dark" | "system";
type Cadence = "monthly" | "annual";
type SelectedPlan = "individual" | "family";

const ACTIVATION_POLL_INTERVAL_MS = 2000;
const ACTIVATION_TIMEOUT_MS = 30000;

const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
}

function readThemeCookie(): Theme {
  if (typeof document === "undefined") return "system";
  const match = /(?:^|;\s*)theme=(light|dark|system)/.exec(document.cookie);
  return (match?.[1] as Theme | undefined) ?? "system";
}

const stepVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    y: direction > 0 ? 32 : -32,
    filter: "blur(4px)",
  }),
  center: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: (direction: number) => ({
    opacity: 0,
    y: direction > 0 ? -24 : 24,
    filter: "blur(4px)",
  }),
};

const languages = [
  { code: "da" as const, label: "Dansk", flag: "🇩🇰" },
  { code: "en" as const, label: "English", flag: "🇬🇧" },
];

const themes = [
  { code: "light" as const, icon: Sun },
  { code: "dark" as const, icon: Moon },
  { code: "system" as const, icon: Monitor },
];

export default function WelcomePage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tTerms = useTranslations("terms");
  const tBilling = useTranslations("billing.onboarding");
  const router = useRouter();
  const currentLocale = useLocale();
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [locale, setLocale] = useState<"da" | "en">(
    currentLocale === "en" ? "en" : "da",
  );
  const [theme, setTheme] = useState<Theme>("system");
  const [familyName, setFamilyName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan>("individual");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);

  const { data: onboardingState } = api.user.getOnboardingState.useQuery();
  const { data: me } = api.user.me.useQuery();
  const { data: families, isLoading: familiesLoading } =
    api.family.list.useQuery();
  const needsFamily = !familiesLoading && families?.length === 0;

  const termsQuery = api.terms.current.useQuery({ locale }, { enabled: ready });

  const steps = useMemo<Step[]>(() => {
    const s: Step[] = ["language", "terms", "name", "theme"];
    if (needsFamily) s.push("family", "plan");
    return s;
  }, [needsFamily]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = steps[currentStepIndex] ?? "name";
  const totalSteps = steps.length;

  // Resume from persisted step — seed editable form state once the user and
  // onboarding records have loaded. These values are user-editable afterward,
  // so they can't be derived during render.
  useEffect(() => {
    if (onboardingState && me && !ready) {
      const resumeIndex = Math.min(
        onboardingState.onboardingStep,
        steps.length - 1,
      );
      /* eslint-disable react-hooks/set-state-in-effect */
      setCurrentStepIndex(resumeIndex);
      setTheme(readThemeCookie());
      // Prefill the existing name so users forced back through onboarding
      // (e.g. the one-time terms re-consent reset) don't have to re-type it.
      if (me.name) setName(me.name);
      setReady(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [onboardingState, me, steps, ready]);

  // Treat the terms as accepted if the user ticked the box now, or already
  // accepted this version before (e.g. when navigating back to this step).
  // Acceptance itself is idempotent server-side.
  const termsAgreed = termsAccepted || termsQuery.data?.accepted === true;

  const updateProfile = api.user.updateProfile.useMutation();
  const acceptTerms = api.terms.accept.useMutation();
  const completeOnboarding = api.user.completeOnboarding.useMutation({
    onSuccess: () => {
      router.push("/dashboard");
    },
  });
  const createFamily = api.family.create.useMutation({
    onSuccess: () => {
      // Advance to the plan step instead of completing onboarding directly.
      setDirection(1);
      setCurrentStepIndex((i) => Math.min(i + 1, steps.length - 1));
    },
  });
  const selectIndividual = api.billing.selectIndividual.useMutation();
  const createSubscription = api.billing.createSubscription.useMutation({
    onSuccess: ({ clientSecret, publishableKey }) => {
      setPaymentInfo({ clientSecret, publishableKey });
    },
  });
  const billingCurrent = api.billing.current.useQuery(undefined, {
    enabled: ready && currentStep === "plan",
    refetchInterval: activating ? ACTIVATION_POLL_INTERVAL_MS : false,
  });

  // Once subscription is active, finish onboarding. Also catches the case
  // where the user reloads after paying — the polling never started, but the
  // status is already active.
  const finishedRef = useRef(false);
  useEffect(() => {
    if (
      currentStep === "plan" &&
      billingCurrent.data?.status === "active" &&
      !finishedRef.current
    ) {
      finishedRef.current = true;
      // Reacting to polled subscription status flipping to "active" — a change
      // in an external system that can only be observed from an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivating(false);
      completeOnboarding.mutate();
    }
  }, [currentStep, billingCurrent.data, completeOnboarding]);

  // Activation timeout fallback.
  useEffect(() => {
    if (!activating) return;
    const timer = setTimeout(() => {
      if (!finishedRef.current) {
        setActivating(false);
        setActivationError(tBilling("activationTimedOut"));
      }
    }, ACTIVATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [activating, tBilling]);

  const isPending =
    updateProfile.isPending ||
    acceptTerms.isPending ||
    completeOnboarding.isPending ||
    createFamily.isPending ||
    selectIndividual.isPending ||
    createSubscription.isPending ||
    activating;

  const error =
    updateProfile.error ??
    acceptTerms.error ??
    completeOnboarding.error ??
    createFamily.error ??
    selectIndividual.error ??
    createSubscription.error;

  const showPaymentForm = currentStep === "plan" && paymentInfo !== null;

  const canContinue =
    !showPaymentForm &&
    ((currentStep === "name" && name.trim().length > 0) ||
      currentStep === "language" ||
      (currentStep === "terms" && Boolean(termsQuery.data) && termsAgreed) ||
      currentStep === "theme" ||
      (currentStep === "family" && familyName.trim().length > 0) ||
      (currentStep === "plan" && !activating));

  const handleContinue = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    const isLastStep = currentStepIndex === totalSteps - 1;

    if (currentStep === "name" && name.trim()) {
      updateProfile.mutate(
        { name: name.trim(), onboardingStep: nextIndex },
        {
          onSuccess: () => {
            setDirection(1);
            setCurrentStepIndex(nextIndex);
          },
        },
      );
    } else if (currentStep === "language") {
      if (isLastStep) {
        updateProfile.mutate(
          { locale },
          { onSuccess: () => completeOnboarding.mutate() },
        );
      } else {
        updateProfile.mutate(
          { locale, onboardingStep: nextIndex },
          {
            onSuccess: () => {
              setDirection(1);
              setCurrentStepIndex(nextIndex);
            },
          },
        );
      }
    } else if (currentStep === "terms") {
      const version = termsQuery.data?.version;
      if (!version) return;
      acceptTerms.mutate(
        { version, locale },
        {
          onSuccess: () => {
            updateProfile.mutate(
              { onboardingStep: nextIndex },
              {
                onSuccess: () => {
                  setDirection(1);
                  setCurrentStepIndex(nextIndex);
                },
              },
            );
          },
        },
      );
    } else if (currentStep === "theme") {
      if (isLastStep) {
        updateProfile.mutate(
          { theme },
          { onSuccess: () => completeOnboarding.mutate() },
        );
      } else {
        updateProfile.mutate(
          { theme, onboardingStep: nextIndex },
          {
            onSuccess: () => {
              setDirection(1);
              setCurrentStepIndex(nextIndex);
            },
          },
        );
      }
    } else if (currentStep === "family" && familyName.trim()) {
      createFamily.mutate({ name: familyName.trim() });
    } else if (currentStep === "plan") {
      if (selectedPlan === "individual") {
        selectIndividual.mutate(undefined, {
          onSuccess: () => completeOnboarding.mutate(),
        });
      } else {
        createSubscription.mutate({ cadence });
      }
    }
  }, [
    currentStep,
    currentStepIndex,
    totalSteps,
    name,
    locale,
    theme,
    familyName,
    selectedPlan,
    cadence,
    updateProfile,
    acceptTerms,
    termsQuery.data?.version,
    completeOnboarding,
    createFamily,
    selectIndividual,
    createSubscription,
  ]);

  const handleBack = useCallback(() => {
    if (showPaymentForm) {
      setPaymentInfo(null);
      return;
    }
    const prevIndex = Math.max(0, currentStepIndex - 1);
    updateProfile.mutate(
      { onboardingStep: prevIndex },
      {
        onSuccess: () => {
          setDirection(-1);
          setCurrentStepIndex(prevIndex);
        },
      },
    );
  }, [currentStepIndex, updateProfile, showPaymentForm]);

  const handleLocaleChange = useCallback(
    (newLocale: "da" | "en") => {
      setLocale(newLocale);
      document.cookie = `locale=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`;
      router.refresh();
    },
    [router],
  );

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
    document.cookie = `theme=${newTheme};path=/;max-age=${THEME_COOKIE_MAX_AGE}`;
    applyTheme(newTheme);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (canContinue && !isPending) handleContinue();
      }
    },
    [canContinue, isPending, handleContinue],
  );

  const handlePaymentSuccess = useCallback(() => {
    setActivating(true);
    setPaymentInfo(null);
  }, []);

  const isDark = useMemo(() => {
    if (typeof document === "undefined") return false;
    return (
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  }, [theme]);

  if (!ready) return null;

  return (
    <>
      {/* Top bar — logo + step indicator */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex items-center justify-between gap-3 px-5 pt-6 sm:px-12 sm:pt-10"
      >
        <span className="font-display text-foreground text-xl tracking-wide">
          {tCommon("appName")}
          <span className="bg-primary ml-0.5 inline-block h-1.5 w-1.5 rounded-full" />
        </span>

        {/* Step dots — centered */}
        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }, (_, i) => (
              <motion.div
                key={i}
                animate={{
                  width: i === currentStepIndex ? 24 : 6,
                  backgroundColor:
                    i <= currentStepIndex
                      ? "hsl(38 60% 50%)"
                      : "hsl(40 15% 90%)",
                }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="h-1.5 rounded-full"
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            router.push("/login");
          }}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
        >
          <LogOut className="size-3.5" />
          <span className="hidden sm:inline">{tCommon("logout")}</span>
        </button>
      </motion.header>

      {/* Main content — vertically centered */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pt-8 pb-32 sm:px-12 sm:pb-24">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {/* Step: Name */}
              {currentStep === "name" && (
                <div>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: 48 }}
                    transition={{
                      duration: 0.6,
                      delay: 0.3,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="bg-primary/40 mb-8 h-px"
                  />

                  <h1 className="font-display text-foreground text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl">
                    {t("welcomeTitle")}
                  </h1>
                  <p className="text-muted-foreground mt-3 text-base sm:text-lg">
                    {t("welcomeDescription")}
                  </p>

                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.2,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="mt-10"
                  >
                    <label
                      htmlFor="name"
                      className="text-foreground mb-3 block text-sm font-medium"
                    >
                      {t("nameLabel")}
                    </label>
                    <Input
                      id="name"
                      type="text"
                      placeholder={t("namePlaceholder")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="h-12 text-base"
                    />
                  </motion.div>
                </div>
              )}

              {/* Step: Language */}
              {currentStep === "language" && (
                <div>
                  <div className="bg-primary/40 mb-8 h-px w-12" />

                  <h1 className="font-display text-foreground text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl">
                    {t("languageTitle")}
                  </h1>
                  <p className="text-muted-foreground mt-3 text-base sm:text-lg">
                    {t("languageDescription")}
                  </p>

                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.2,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="mt-10 space-y-3"
                  >
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleLocaleChange(lang.code)}
                        className={cn(
                          "flex w-full items-center gap-4 rounded-lg border px-4 py-4 text-left transition-all",
                          locale === lang.code
                            ? "border-primary bg-accent"
                            : "border-border bg-background hover:border-primary/30 hover:bg-accent/50",
                        )}
                      >
                        <span className="text-2xl">{lang.flag}</span>
                        <span className="text-foreground flex-1 text-base font-medium">
                          {lang.label}
                        </span>
                        {locale === lang.code && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 30,
                            }}
                            className="bg-primary flex h-5 w-5 items-center justify-center rounded-full"
                          >
                            <Check className="text-primary-foreground h-3 w-3" />
                          </motion.div>
                        )}
                      </button>
                    ))}
                  </motion.div>
                </div>
              )}

              {/* Step: Terms */}
              {currentStep === "terms" && (
                <div>
                  <div className="bg-primary/40 mb-8 h-px w-12" />

                  <h1 className="font-display text-foreground text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl">
                    {tTerms("onboardingTitle")}
                  </h1>
                  <p className="text-muted-foreground mt-3 text-base sm:text-lg">
                    {tTerms("onboardingDescription")}
                  </p>

                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.2,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="mt-8"
                  >
                    <div className="border-border bg-card/50 max-h-[42vh] overflow-y-auto rounded-lg border p-5">
                      {termsQuery.data ? (
                        <TermsContent content={termsQuery.data.content} />
                      ) : (
                        <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
                          <Loader2 className="size-4 animate-spin" />
                          {tTerms("loading")}
                        </div>
                      )}
                    </div>

                    <label className="mt-5 flex cursor-pointer items-start gap-3">
                      <Checkbox
                        checked={termsAgreed}
                        onCheckedChange={(v) => setTermsAccepted(v === true)}
                        className="mt-0.5 size-5"
                      />
                      <span className="text-foreground text-sm">
                        {tTerms("acceptLabel")}
                      </span>
                    </label>
                  </motion.div>
                </div>
              )}

              {/* Step: Theme */}
              {currentStep === "theme" && (
                <div>
                  <div className="bg-primary/40 mb-8 h-px w-12" />

                  <h1 className="font-display text-foreground text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl">
                    {t("themeTitle")}
                  </h1>
                  <p className="text-muted-foreground mt-3 text-base sm:text-lg">
                    {t("themeDescription")}
                  </p>

                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.2,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="mt-10 space-y-3"
                  >
                    {themes.map((option) => {
                      const Icon = option.icon;
                      const isSelected = theme === option.code;
                      const labelKey =
                        option.code === "light"
                          ? "themeLight"
                          : option.code === "dark"
                            ? "themeDark"
                            : "themeSystem";
                      return (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => handleThemeChange(option.code)}
                          className={cn(
                            "flex w-full items-center gap-4 rounded-lg border px-4 py-4 text-left transition-all",
                            isSelected
                              ? "border-primary bg-accent"
                              : "border-border bg-background hover:border-primary/30 hover:bg-accent/50",
                          )}
                        >
                          <Icon className="text-foreground size-5" />
                          <div className="flex-1">
                            <div className="text-foreground text-base font-medium">
                              {t(labelKey)}
                            </div>
                            {option.code === "system" && (
                              <div className="text-muted-foreground text-xs">
                                {t("themeSystemDescription")}
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 30,
                              }}
                              className="bg-primary flex h-5 w-5 items-center justify-center rounded-full"
                            >
                              <Check className="text-primary-foreground h-3 w-3" />
                            </motion.div>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                </div>
              )}

              {/* Step: Plan */}
              {currentStep === "plan" && (
                <div>
                  <div className="bg-primary/40 mb-8 h-px w-12" />

                  <h1 className="font-display text-foreground text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl">
                    {tBilling("title")}
                  </h1>
                  <p className="text-muted-foreground mt-3 text-base sm:text-lg">
                    {tBilling("description")}
                  </p>

                  {activating ? (
                    <div className="border-primary/30 bg-primary/5 mt-10 rounded-lg border p-6 text-center">
                      <Loader2 className="text-primary mx-auto mb-3 size-6 animate-spin" />
                      <div className="text-foreground font-medium">
                        {tBilling("activating")}
                      </div>
                      <div className="text-muted-foreground mt-1 text-sm">
                        {tBilling("activatingHint")}
                      </div>
                    </div>
                  ) : showPaymentForm && paymentInfo ? (
                    <div className="mt-8">
                      <PaymentForm
                        clientSecret={paymentInfo.clientSecret}
                        publishableKey={paymentInfo.publishableKey}
                        returnUrl={
                          typeof window !== "undefined"
                            ? `${window.location.origin}/welcome`
                            : "/welcome"
                        }
                        onSuccess={handlePaymentSuccess}
                        isDark={isDark}
                      />
                      {activationError && (
                        <p className="text-destructive mt-4 text-sm">
                          {activationError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      {activationError && (
                        <p className="text-destructive mt-6 text-sm">
                          {activationError}
                        </p>
                      )}

                      <div className="border-border bg-card shadow-card mt-8 inline-flex items-center gap-1 rounded-full border p-1">
                        {(["monthly", "annual"] as const).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCadence(c)}
                            className={cn(
                              "almanac-smallcaps relative rounded-full px-4 py-1.5 text-[10px] tracking-[0.22em] transition-colors",
                              cadence === c
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {locale === "da"
                              ? c === "monthly"
                                ? "Månedlig"
                                : "Årlig"
                              : c === "monthly"
                                ? "Monthly"
                                : "Annual"}
                          </button>
                        ))}
                      </div>

                      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <PlanCard
                          planKey="individual"
                          cadence={cadence}
                          selected={selectedPlan === "individual"}
                          onSelect={() => setSelectedPlan("individual")}
                        />
                        <PlanCard
                          planKey="family"
                          cadence={cadence}
                          selected={selectedPlan === "family"}
                          onSelect={() => setSelectedPlan("family")}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step: Family */}
              {currentStep === "family" && (
                <div>
                  <div className="bg-primary/40 mb-8 h-px w-12" />

                  <h1 className="font-display text-foreground text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl">
                    {t("familyTitle")}
                  </h1>
                  <p className="text-muted-foreground mt-3 text-base sm:text-lg">
                    {t("familyDescription")}
                  </p>

                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.2,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="mt-10"
                  >
                    <label
                      htmlFor="familyName"
                      className="text-foreground mb-3 block text-sm font-medium"
                    >
                      {t("familyNameLabel")}
                    </label>
                    <Input
                      id="familyName"
                      type="text"
                      placeholder={t("familyNamePlaceholder")}
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="h-12 text-base"
                    />
                  </motion.div>
                </div>
              )}

              {/* Shared error display */}
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-destructive mt-4 text-sm"
                >
                  {tCommon("error")}
                </motion.p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Floating back button — bottom left */}
      <AnimatePresence>
        {(currentStepIndex > 0 || showPaymentForm) && (
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-[max(env(safe-area-inset-bottom,0px),1.25rem)] left-4 z-20 sm:bottom-10 sm:left-12"
          >
            <Button
              variant="ghost"
              size="lg"
              onClick={handleBack}
              className="h-12 gap-2 rounded-full px-6"
            >
              <ArrowLeft className="size-4" />
              {tCommon("back")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating continue button — bottom right */}
      {!showPaymentForm && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.5,
            delay: 0.4,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="fixed right-4 bottom-[max(env(safe-area-inset-bottom,0px),1.25rem)] z-20 sm:right-12 sm:bottom-10"
        >
          <Button
            size="lg"
            disabled={!canContinue || isPending}
            onClick={handleContinue}
            className="shadow-elevated h-12 gap-2 rounded-full px-6 transition-all duration-200 hover:shadow-lg disabled:opacity-40"
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                {tCommon("loading")}
              </>
            ) : (
              <>
                {currentStep === "plan"
                  ? selectedPlan === "individual"
                    ? tBilling("individualCta")
                    : tBilling("familyCta")
                  : currentStepIndex === totalSteps - 1
                    ? t("getStarted")
                    : t("continue")}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </motion.div>
      )}
    </>
  );
}
