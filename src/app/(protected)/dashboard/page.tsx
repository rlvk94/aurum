import { api, HydrateClient } from "~/trpc/server";
import { InstallPrompt } from "~/app/_components/install-prompt";
import { DashboardClient } from "./_components/dashboard-client";

export default async function DashboardPage() {
  const billing = await api.billing.current();
  const currentYear = new Date().getFullYear();
  const hasFamilyFeatures = billing.plan === "family";

  // Prefetch everything the dashboard needs server-side
  await Promise.all([
    api.billing.current.prefetch(),
    api.financialAccount.summary.prefetch(),
    api.financialAccount.list.prefetch(),
    api.transaction.weeklyExpense.prefetch(),
    api.transaction.list.prefetch({ limit: 5 }),
    api.budget.list.prefetch({ year: currentYear }),
    ...(hasFamilyFeatures
      ? [
          api.asset.summary.prefetch(),
          api.debt.summary.prefetch(),
          api.challenge.list.prefetch(),
          api.project.list.prefetch({ includeArchived: false }),
        ]
      : []),
  ]);

  return (
    <HydrateClient>
      <DashboardClient />
      <InstallPrompt />
    </HydrateClient>
  );
}
