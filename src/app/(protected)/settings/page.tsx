import { useTranslations } from "next-intl";
import { PageHeader } from "~/app/_components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";
import { Separator } from "~/app/_components/separator";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tFamily = useTranslations("family");

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("familySettings")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {tFamily("familyName")}, {tFamily("familyDescription")}, {tFamily("familyCurrency")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("memberManagement")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {tFamily("inviteMember")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("categories")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">–</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("language")}</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <p className="text-sm text-muted-foreground">
              {t("languageDa")} / {t("languageEn")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
