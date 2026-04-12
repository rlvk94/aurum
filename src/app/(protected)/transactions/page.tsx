import { useTranslations } from "next-intl";
import { ArrowLeftRight, Plus, Upload } from "lucide-react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";

export default function TransactionsPage() {
  const t = useTranslations("transactions");

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        actions={
          <>
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              {t("importCsv")}
            </Button>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("addTransaction")}
            </Button>
          </>
        }
      />

      <EmptyState icon={ArrowLeftRight} message={t("emptyState")} />
    </div>
  );
}
