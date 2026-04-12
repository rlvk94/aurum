import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { PageHeader } from "~/app/_components/page-header";
import { EmptyState } from "~/app/_components/empty-state";

export default function ImportPage() {
  const t = useTranslations("import");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <EmptyState icon={Upload} message={t("emptyState")} />
    </div>
  );
}
