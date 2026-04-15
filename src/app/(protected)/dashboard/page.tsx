import { api } from "~/trpc/server";
import { DashboardClient } from "./_components/dashboard-client";

export default async function DashboardPage() {
  // Prefetch everything the dashboard needs server-side
  await Promise.all([
    api.financialAccount.summary.prefetch(),
    api.financialAccount.list.prefetch(),
    api.asset.summary.prefetch(),
    api.transaction.weeklyExpense.prefetch(),
    api.transaction.list.prefetch({ limit: 5 }),
  ]);

  return <DashboardClient />;
}
