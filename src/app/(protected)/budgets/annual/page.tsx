import { useTranslations } from "next-intl";
import { PieChart, Plus } from "lucide-react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";

export default function AnnualBudgetPage() {
  const t = useTranslations("budgets");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("annualBudget")}
        actions={
          <Button>
            <Plus />
            {t("createBudget")}
          </Button>
        }
      />

      <EmptyState icon={PieChart} message={t("emptyState")} />
    </div>
  );
}
