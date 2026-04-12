import { useTranslations } from "next-intl";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  ArrowLeftRight,
  PieChart,
} from "lucide-react";
import { PageHeader } from "~/app/_components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/app/_components/card";

function StatCard({
  title,
  value,
  icon: Icon,
  className,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${className ?? "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("weeklySpent")}
          value="–"
          icon={ArrowLeftRight}
        />
        <StatCard
          title={t("totalBalance")}
          value="–"
          icon={Wallet}
        />
        <StatCard
          title={t("totalDebt")}
          value="–"
          icon={TrendingDown}
          className="text-debt"
        />
        <StatCard
          title={t("netWorth")}
          value="–"
          icon={TrendingUp}
          className="text-income"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("recentTransactions")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">–</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("budgetStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">–</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
