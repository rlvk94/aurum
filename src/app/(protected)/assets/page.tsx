import { useTranslations } from "next-intl";
import { Landmark, Plus } from "lucide-react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";

export default function AssetsPage() {
  const t = useTranslations("assets");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Button>
            <Plus />
            {t("addAsset")}
          </Button>
        }
      />

      <EmptyState
        icon={Landmark}
        message="Ingen aktiver endnu. Tilføj dine aktiver for at se din formue."
      />
    </div>
  );
}
