import { useTranslations } from "next-intl";
import { Target, Plus } from "lucide-react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";

export default function ChallengesPage() {
  const t = useTranslations("budgets");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("challenges")}
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("createChallenge")}
          </Button>
        }
      />

      <EmptyState icon={Target} message={t("emptyState")} />
    </div>
  );
}
