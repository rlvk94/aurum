import { useTranslations } from "next-intl";
import Link from "next/link";
import { ChevronRight, Users, Tag, Globe, Home } from "lucide-react";
import { PageHeader } from "~/app/_components/page-header";

function SettingsLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/40"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
        <Icon className="h-5 w-5 text-accent-foreground" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tFamily = useTranslations("family");
  const tCategories = useTranslations("categories");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <div className="grid gap-3 sm:grid-cols-2">
        <SettingsLink
          href="/settings/family"
          icon={Home}
          title={t("familySettings")}
          description={tFamily("familyName")}
        />
        <SettingsLink
          href="/settings/members"
          icon={Users}
          title={t("memberManagement")}
          description={tFamily("inviteMember")}
        />
        <SettingsLink
          href="/settings/categories"
          icon={Tag}
          title={tCategories("title")}
          description={tCategories("emptyState")}
        />
        <SettingsLink
          href="/settings/language"
          icon={Globe}
          title={t("language")}
          description={`${t("languageDa")} · ${t("languageEn")}`}
        />
      </div>
    </div>
  );
}
