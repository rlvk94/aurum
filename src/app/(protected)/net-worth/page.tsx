import { useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";

export default function NetWorthPage() {
  const t = useTranslations("netWorth");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("accountBalances")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">–</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalAssets")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">–</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalDebts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">–</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("netWorthValue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-income">–</div>
          </CardContent>
        </Card>
      </div>

      <EmptyState icon={TrendingUp} message={t("emptyState")} />
    </div>
  );
}
