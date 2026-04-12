import { useTranslations } from "next-intl";
import { PieChart, Plus } from "lucide-react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/app/_components/tabs";

export default function BudgetsPage() {
  const t = useTranslations("budgets");

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("createBudget")}
          </Button>
        }
      />

      <Tabs defaultValue="budget">
        <TabsList>
          <TabsTrigger value="budget">{t("annualBudget")}</TabsTrigger>
          <TabsTrigger value="challenges">{t("challenges")}</TabsTrigger>
        </TabsList>
        <TabsContent value="budget" className="mt-6">
          <EmptyState icon={PieChart} message={t("emptyState")} />
        </TabsContent>
        <TabsContent value="challenges" className="mt-6">
          <EmptyState icon={PieChart} message={t("emptyState")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
