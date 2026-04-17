"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { api } from "~/trpc/react";
import { PageHeader } from "~/app/_components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import { RadioGroup, RadioGroupItem } from "~/app/_components/radio-group";
import { Label } from "~/app/_components/label";

type Locale = "da" | "en";
type Theme = "light" | "dark" | "system";

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
}

export function AppearanceForm() {
  const t = useTranslations("settings.appearance");
  const tSettings = useTranslations("settings");
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

  const currentLocale = me?.locale ?? "da";
  const currentTheme = (me?.theme as Theme | undefined) ?? "system";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("languageTitle")}</CardTitle>
          <CardDescription>{t("languageDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={currentLocale}
            onValueChange={(v) => handleLocaleChange(v as Locale)}
            className="gap-3"
          >
            <div className="flex items-center gap-3 rounded-md border border-border p-3">
              <RadioGroupItem value="da" id="locale-da" />
              <Label htmlFor="locale-da" className="flex-1 cursor-pointer">
                {tSettings("languageDa")}
              </Label>
            </div>
            <div className="flex items-center gap-3 rounded-md border border-border p-3">
              <RadioGroupItem value="en" id="locale-en" />
              <Label htmlFor="locale-en" className="flex-1 cursor-pointer">
                {tSettings("languageEn")}
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("themeTitle")}</CardTitle>
          <CardDescription>{t("themeDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={currentTheme}
            onValueChange={(v) => handleThemeChange(v as Theme)}
            className="gap-3"
          >
            <div className="flex items-center gap-3 rounded-md border border-border p-3">
              <RadioGroupItem value="light" id="theme-light" />
              <Label htmlFor="theme-light" className="flex-1 cursor-pointer">
                {t("themeLight")}
              </Label>
            </div>
            <div className="flex items-center gap-3 rounded-md border border-border p-3">
              <RadioGroupItem value="dark" id="theme-dark" />
              <Label htmlFor="theme-dark" className="flex-1 cursor-pointer">
                {t("themeDark")}
              </Label>
            </div>
            <div className="flex items-start gap-3 rounded-md border border-border p-3">
              <RadioGroupItem value="system" id="theme-system" className="mt-0.5" />
              <Label htmlFor="theme-system" className="flex-1 cursor-pointer">
                <div className="font-medium">{t("themeSystem")}</div>
                <div className="text-xs font-normal text-muted-foreground">
                  {t("themeSystemDescription")}
                </div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}
