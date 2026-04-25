import { useTranslations } from "next-intl";
import { SectionMarker } from "./section-marker";
import { FeatureRow } from "./feature-row";
import { BudgetStrip } from "./feature-visuals/budget-strip";
import { FamilyCard } from "./feature-visuals/family-card";
import { TransactionsList } from "./feature-visuals/transactions-list";
import { ChallengeDial } from "./feature-visuals/challenge-dial";
import { NetWorthChart } from "./feature-visuals/networth-chart";

export function LandingFeatures() {
  const t = useTranslations("landing.features");

  const items = [
    {
      key: "budget",
      folio: "01",
      side: "right" as const,
      visual: <BudgetStrip />,
    },
    {
      key: "family",
      folio: "02",
      side: "left" as const,
      visual: <FamilyCard />,
    },
    {
      key: "transactions",
      folio: "03",
      side: "right" as const,
      visual: <TransactionsList />,
    },
    {
      key: "challenges",
      folio: "04",
      side: "left" as const,
      visual: <ChallengeDial />,
    },
    {
      key: "networth",
      folio: "05",
      side: "right" as const,
      visual: <NetWorthChart />,
    },
  ];

  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <header className="max-w-2xl">
          <SectionMarker>{t("marker")}</SectionMarker>
          <h2 className="mt-4 font-display text-4xl leading-tight text-foreground sm:text-5xl">
            {t("heading")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {t("lead")}
          </p>
        </header>

        <div className="mt-8 divide-y divide-primary/10">
          {items.map((item) => (
            <FeatureRow
              key={item.key}
              folio={item.folio}
              side={item.side}
              eyebrow={t(`items.${item.key}.eyebrow`)}
              headline={t(`items.${item.key}.headline`)}
              body={t(`items.${item.key}.body`)}
              visual={item.visual}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
