"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import { api } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import { cn } from "~/app/_lib/utils";

type Locale = "da" | "en";
type Theme = "light" | "dark" | "system";

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const languages = [
  { code: "da" as const, label: "Dansk", flag: "🇩🇰" },
  { code: "en" as const, label: "English", flag: "🇬🇧" },
];

const themes = [
  { code: "light" as const, icon: Sun },
  { code: "dark" as const, icon: Moon },
  { code: "system" as const, icon: Monitor },
] as const;

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
}

export function AppearanceForm() {
  const t = useTranslations("settings.appearance");
  const router = useRouter();
  const utils = api.useUtils();
  const { data: me } = api.user.me.useQuery();

  const updateProfile = api.user.updateProfile.useMutation({
    onSuccess: () => void utils.user.me.invalidate(),
  });

  const handleLocaleChange = (locale: Locale) => {
    document.cookie = `locale=${locale};path=/;max-age=${LOCALE_COOKIE_MAX_AGE}`;
    updateProfile.mutate({ locale });
    router.refresh();
  };

  const handleThemeChange = (theme: Theme) => {
    document.cookie = `theme=${theme};path=/;max-age=${THEME_COOKIE_MAX_AGE}`;
    applyTheme(theme);
    updateProfile.mutate({ theme });
  };

  const currentLocale = (me?.locale as Locale | undefined) ?? "da";
  const currentTheme = (me?.theme as Theme | undefined) ?? "system";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("languageTitle")}</CardTitle>
          <CardDescription>{t("languageDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {languages.map((lang) => {
            const isSelected = currentLocale === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLocaleChange(lang.code)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-lg border px-4 py-4 text-left transition-all",
                  isSelected
                    ? "border-primary bg-accent"
                    : "border-border bg-background hover:border-primary/30 hover:bg-accent/50",
                )}
              >
                <span className="text-2xl">{lang.flag}</span>
                <span className="flex-1 text-base font-medium text-foreground">
                  {lang.label}
                </span>
                {isSelected && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </span>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("themeTitle")}</CardTitle>
          <CardDescription>{t("themeDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {themes.map((option) => {
            const Icon = option.icon;
            const isSelected = currentTheme === option.code;
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
                <Icon className="size-5 text-foreground" />
                <div className="flex-1">
                  <div className="text-base font-medium text-foreground">
                    {t(labelKey)}
                  </div>
                  {option.code === "system" && (
                    <div className="text-xs text-muted-foreground">
                      {t("themeSystemDescription")}
                    </div>
                  )}
                </div>
                {isSelected && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </span>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
