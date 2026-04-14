"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Loader2, Check, LogOut } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { authClient } from "~/app/_lib/auth-client";
import { api } from "~/trpc/react";
import { Button } from "~/app/_components/button";
import { Input } from "~/app/_components/input";
import { cn } from "~/app/_lib/utils";

type Step = "name" | "language" | "family";

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

export default function WelcomePage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const currentLocale = useLocale();
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState("");
  const [locale, setLocale] = useState<"da" | "en">(
    currentLocale === "en" ? "en" : "da",
  );
  const [familyName, setFamilyName] = useState("");
  const [ready, setReady] = useState(false);

  const { data: onboardingState } = api.user.getOnboardingState.useQuery();
  const { data: families, isLoading: familiesLoading } =
    api.family.list.useQuery();
  const needsFamily = !familiesLoading && families?.length === 0;

  const steps = useMemo<Step[]>(() => {
    const s: Step[] = ["name", "language"];
    if (needsFamily) s.push("family");
    return s;
  }, [needsFamily]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = steps[currentStepIndex] ?? "name";
  const totalSteps = steps.length;

  // Resume from persisted step
  useEffect(() => {
    if (onboardingState && !ready) {
      const resumeIndex = Math.min(
        onboardingState.onboardingStep,
        steps.length - 1,
      );
      setCurrentStepIndex(resumeIndex);
      setReady(true);
    }
  }, [onboardingState, steps.length, ready]);

  const updateProfile = api.user.updateProfile.useMutation();
  const completeOnboarding = api.user.completeOnboarding.useMutation({
    onSuccess: () => {
      router.push("/dashboard");
    },
  });
  const createFamily = api.family.create.useMutation({
    onSuccess: () => {
      completeOnboarding.mutate();
    },
  });

  const isPending =
    updateProfile.isPending ||
    completeOnboarding.isPending ||
    createFamily.isPending;

  const error =
    updateProfile.error ?? completeOnboarding.error ?? createFamily.error;

  const canContinue =
    (currentStep === "name" && name.trim().length > 0) ||
    currentStep === "language" ||
    (currentStep === "family" && familyName.trim().length > 0);

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
    } else if (currentStep === "family" && familyName.trim()) {
      createFamily.mutate({ name: familyName.trim() });
    }
  }, [
    currentStep,
    currentStepIndex,
    totalSteps,
    name,
    locale,
    familyName,
    updateProfile,
    completeOnboarding,
    createFamily,
  ]);

  const handleBack = useCallback(() => {
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
  }, [currentStepIndex, updateProfile]);

  const handleLocaleChange = useCallback(
    (newLocale: "da" | "en") => {
      setLocale(newLocale);
      document.cookie = `locale=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`;
      router.refresh();
    },
    [router],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (canContinue && !isPending) handleContinue();
      }
    },
    [canContinue, isPending, handleContinue],
  );

  if (!ready) return null;

  return (
    <>
      {/* Top bar — logo + step indicator */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex items-center justify-between px-8 pt-8 sm:px-12 sm:pt-10"
      >
        <span className="font-display text-xl tracking-wide text-foreground">
          {tCommon("appName")}
          <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
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
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="size-3.5" />
          {tCommon("logout")}
        </button>
      </motion.header>

      {/* Main content — vertically centered */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-8 pb-24 sm:px-12">
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
                    className="mb-8 h-px bg-primary/40"
                  />

                  <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
                    {t("welcomeTitle")}
                  </h1>
                  <p className="mt-3 text-lg text-muted-foreground">
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
                      className="mb-3 block text-sm font-medium text-foreground"
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
                  <div className="mb-8 h-px w-12 bg-primary/40" />

                  <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
                    {t("languageTitle")}
                  </h1>
                  <p className="mt-3 text-lg text-muted-foreground">
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
                        <span className="flex-1 text-base font-medium text-foreground">
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
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-primary"
                          >
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </motion.div>
                        )}
                      </button>
                    ))}
                  </motion.div>
                </div>
              )}

              {/* Step: Family */}
              {currentStep === "family" && (
                <div>
                  <div className="mb-8 h-px w-12 bg-primary/40" />

                  <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
                    {t("familyTitle")}
                  </h1>
                  <p className="mt-3 text-lg text-muted-foreground">
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
                      className="mb-3 block text-sm font-medium text-foreground"
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
                  className="mt-4 text-sm text-destructive"
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
        {currentStepIndex > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-8 left-8 z-20 sm:bottom-10 sm:left-12"
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
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.5,
          delay: 0.4,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="fixed bottom-8 right-8 z-20 sm:bottom-10 sm:right-12"
      >
        <Button
          size="lg"
          disabled={!canContinue || isPending}
          onClick={handleContinue}
          className="h-12 gap-2 rounded-full px-6 shadow-elevated transition-all duration-200 hover:shadow-lg disabled:opacity-40"
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              {tCommon("loading")}
            </>
          ) : (
            <>
              {currentStepIndex === totalSteps - 1
                ? t("getStarted")
                : t("continue")}
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </motion.div>
    </>
  );
}
