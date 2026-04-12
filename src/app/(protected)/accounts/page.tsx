import { useTranslations } from "next-intl";
import { Wallet, Plus } from "lucide-react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";
import { Button } from "~/app/_components/button";

export default function AccountsPage() {
  const t = useTranslations("accounts");
  const tCommon = useTranslations("common");

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("addAccount")}
          </Button>
        }
      />

      <EmptyState icon={Wallet} message={t("emptyState")} />
    </div>
  );
}
